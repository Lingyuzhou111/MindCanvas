// Video Generation API Integration
// Supports SiliconFlow async submit+poll pattern; extensible to other platforms.

// ── Ratio → image_size mapping for SiliconFlow ──────────────────────────────
// SiliconFlow accepts exact pixel strings like "1280x720"
const SF_SIZE_MAP = {
    '16:9': { '480P': '854x480', '720P': '1280x720', '1080P': '1920x1080' },
    '9:16': { '480P': '480x854', '720P': '720x1280', '1080P': '1080x1920' },
    '1:1': { '480P': '480x480', '720P': '960x960', '1080P': '1080x1080' },
    '4:3': { '480P': '640x480', '720P': '960x720', '1080P': '1440x1080' },
    '3:4': { '480P': '480x640', '720P': '720x960', '1080P': '1080x1440' },
};

function getSiliconFlowImageSize(ratio, quality) {
    return SF_SIZE_MAP[ratio]?.[quality] ?? '1280x720';
}

// ── Helper: compress base64 image for upload ─────────────────────────────────
const compressImage = (base64Str, maxSize = 1024) =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (width <= maxSize && height <= maxSize) { resolve(base64Str); return; }
            if (width > height) { height = Math.round((height * maxSize) / width); width = maxSize; }
            else { width = Math.round((width * maxSize) / height); height = maxSize; }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => reject(new Error('图片压缩加载失败'));
        img.src = base64Str;
    });

// ── Polling helper ────────────────────────────────────────────────────────────
const poll = (fn, intervalMs = 5000, maxAttempts = 120) =>
    new Promise((resolve, reject) => {
        let attempts = 0;
        const tick = async () => {
            attempts++;
            if (attempts > maxAttempts) { reject(new Error('轮询超时，请稍后检查结果')); return; }
            try {
                const result = await fn(attempts);
                if (result !== null) resolve(result);
                else setTimeout(tick, intervalMs);
            } catch (e) { reject(e); }
        };
        setTimeout(tick, intervalMs); // first poll after one full interval
    });

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * generateVideo
 * @param {string} apiKey
 * @param {string} prompt
 * @param {object} params  { platform, model, submitUrl, statusUrl,
 *                           ratio, duration, quality, mode,
 *                           img1Data, img2Data }
 * @param {function} onProgress  ({ status, message }) => void
 * @returns {Promise<string>}  video URL
 */
export const generateVideo = async (apiKey, prompt, params, onProgress) => {
    const {
        platform, model, submitUrl, statusUrl,
        ratio = '16:9', quality = '720P',
        img1Data, img2Data,
    } = params;

    if (!apiKey) throw new Error(`请先在设置中配置 ${platform} 的 API Key`);
    if (!prompt?.trim()) throw new Error('请输入提示词');

    onProgress({ status: 'compressing', message: '正在处理参考图像...' });

    const processedImg1 = img1Data ? await compressImage(img1Data, 1280).catch(() => img1Data) : null;
    const processedImg2 = img2Data ? await compressImage(img2Data, 1280).catch(() => img2Data) : null;
    const hasImage = typeof processedImg1 === 'string' && processedImg1.length > 0;

    // ── SiliconFlow ─────────────────────────────────────────────────────────────
    if (platform === 'SiliconFlow') {
        onProgress({ status: 'submitting', message: '正在提交视频生成任务...' });

        const body = {
            model,
            prompt,
            image_size: getSiliconFlowImageSize(ratio, quality),
        };

        // Attach reference image if available (I2V model)
        if (hasImage) {
            body.image = processedImg1; // base64 or URL both accepted
        }

        const submitRes = await fetch('/api/siliconflow/v1/video/submit', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!submitRes.ok) {
            const err = await submitRes.json().catch(() => ({}));
            throw new Error(`SiliconFlow 提交失败: ${submitRes.status} ${err.message || ''}`);
        }

        const { requestId } = await submitRes.json();
        if (!requestId) throw new Error('SiliconFlow 未返回 requestId');

        onProgress({ status: 'polling', message: `任务已提交 (${requestId.slice(0, 8)}…)，正在等待生成完成...` });

        // Poll status
        return await poll(async (attempt) => {
            onProgress({ status: 'polling', message: `正在轮询生成结果... (${attempt * 5}s)` });

            const statusRes = await fetch('/api/siliconflow/v1/video/status', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ requestId }),
            });

            if (!statusRes.ok) {
                const err = await statusRes.json().catch(() => ({}));
                throw new Error(`查询状态失败: ${statusRes.status} ${err.message || ''}`);
            }

            const data = await statusRes.json();
            // Possible statuses: "InQueue", "Preparing", "Running", "Succeed", "Failed"
            if (data.status === 'Succeed') {
                const videoUrl = data.results?.videos?.[0]?.url;
                if (!videoUrl) throw new Error('生成成功，但未返回视频链接');
                onProgress({ status: 'success', message: '视频生成成功！' });
                return videoUrl;
            }
            if (data.status === 'Failed') {
                throw new Error(`生成失败: ${data.reason || '未知错误'}`);
            }
            // Still running – return null to keep polling
            return null;
        }, 5000, 144); // max 144 × 5s = 12min

        // ── Aliyun (DashScope async tasks) ──────────────────────────────────────
    } else if (platform === 'Aliyun') {
        const proxyPrefix = '/api/aliyun';
        const submitEndpoint = submitUrl.replace('https://dashscope.aliyuncs.com', proxyPrefix);

        // Parameters
        const durationNum = parseInt(params.duration ?? '5', 10) || 5;
        // Aliyun's wan2.6 models support image & audio
        const payload = {
            model: params.model,
            input: {
                prompt: prompt
            },
            parameters: {
                resolution: params.quality || '720P',
                prompt_extend: true,
                duration: durationNum
            }
        };

        // If img1Data is present, add img_url
        if (hasImage) {
            payload.input.img_url = processedImg1;
            if (params.audioData) {
                // Multi-modal (Image + Audio)
                payload.input.audio_url = params.audioData;
                payload.parameters.shot_type = "multi"; // Aliyun multi-modal indicator
            }
        }

        onProgress({ message: '正在提交任务 (Aliyun)...' });

        const submitRes = await fetch(submitEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'X-DashScope-Async': 'enable'
            },
            body: JSON.stringify(payload)
        });

        if (!submitRes.ok) {
            const err = await submitRes.json().catch(() => ({}));
            throw new Error(`Aliyun 提交失败: ${submitRes.status} ${err.code || ''} ${err.message || ''}`);
        }

        const submitData = await submitRes.json();
        const taskId = submitData.output?.task_id;
        if (!taskId) throw new Error('未获取到 Aliyun 任务ID');

        onProgress({ message: '任务排队中...' });

        // Polling Task Status
        const statusEndpointBase = (params.statusUrl || 'https://dashscope.aliyuncs.com/api/v1/tasks').replace('https://dashscope.aliyuncs.com', proxyPrefix);

        return poll(async () => {
            const statusRes = await fetch(`${statusEndpointBase}/${taskId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });

            if (!statusRes.ok) {
                const err = await statusRes.json().catch(() => ({}));
                throw new Error(`获取状态失败: ${statusRes.status} ${err.code || ''}`);
            }

            const data = await statusRes.json();
            const state = data.output?.task_status;

            if (state === 'SUCCEEDED') {
                const url = data.output?.video_url;
                if (!url) throw new Error('任务完成，但未返回视频 URL');
                return url;
            }

            if (state === 'FAILED' || state === 'CANCELED') {
                throw new Error(`生成失败: ${data.output?.message || state}`);
            }

            // Still running
            return null;
        }, 5000, 144); // max 12 mins

        // ── T8star / ThirdParty2 (OpenAI chat completions format) ──────────────────
    } else if (platform === 'T8star' || platform === 'ThirdParty2') {

        // Map platform → vite proxy prefix
        const proxyPrefix = platform === 'T8star' ? '/api/t8star' : '/api/thirdparty2';

        // Convert our ratio string to the format Grok expects (keep as-is, already "16:9" etc.)
        // Duration from "5s" → 5
        const videoLength = parseInt(params.duration ?? '5', 10) || 5;
        // Quality "720P" → "HD", "1080P" → "HD", "480P" → "SD"
        const resolution = (params.quality === '480P') ? 'SD' : 'HD';
        // Preset: always "normal" (no UI for this yet)
        const preset = 'normal';

        const video_config = {
            aspect_ratio: ratio,
            video_length: videoLength,
            resolution,
            preset,
        };

        // Build content: multipart if image present, plain string otherwise
        let content;
        if (hasImage) {
            content = [
                { type: 'text', text: prompt },
                {
                    type: 'image_url',
                    image_url: { url: processedImg1, detail: 'high' },
                },
            ];
            onProgress({ status: 'submitting', message: `图生视频模式 – 正在提交至 ${platform}...` });
        } else {
            content = prompt;
            onProgress({ status: 'submitting', message: `文生视频模式 – 正在提交至 ${platform}...` });
        }

        const payload = {
            model,
            messages: [{ role: 'user', content }],
            stream: false,
            video_config,
        };

        const res = await fetch(`${proxyPrefix}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(`${platform} 请求失败: ${res.status} ${err.error?.message || err.message || ''}`);
        }

        const data = await res.json();

        if (data.error) {
            throw new Error(`${platform} API 错误: ${data.error.message || JSON.stringify(data.error)}`);
        }

        const responseContent = data.choices?.[0]?.message?.content ?? '';
        if (!responseContent) {
            throw new Error(`${platform} 未返回内容`);
        }

        // Extract video URL from text: try .mp4/.webm direct link → markdown link → any https link
        const videoUrl = extractVideoUrl(responseContent);
        if (!videoUrl) {
            // Return raw content to status bar so user can copy it manually
            throw new Error(`未能从响应中找到视频链接。\n原始响应（可复制）：\n${responseContent}`);
        }

        onProgress({ status: 'success', message: `生成成功！${videoUrl}` });
        return videoUrl;

        // ── Volcengine (Ark contents generations) ──────────────────────────────────
    } else if (platform === 'Volcengine') {
        const proxyPrefix = '/api/volcengine';
        const submitEndpoint = submitUrl.replace('https://ark.cn-beijing.volces.com', proxyPrefix);

        const content = [{ type: 'text', text: prompt }];
        if (hasImage) {
            content.push({
                type: 'image_url',
                image_url: { url: processedImg1 }
            });
        }

        const payload = {
            model: model,
            content: content
        };

        onProgress({ status: 'submitting', message: '正在提交任务 (Volcengine)...' });

        const submitRes = await fetch(submitEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!submitRes.ok) {
            const err = await submitRes.json().catch(() => ({}));
            throw new Error(`Volcengine 提交失败: ${submitRes.status} ${err.error?.message || err.message || ''}`);
        }

        const submitData = await submitRes.json();
        const taskId = submitData.id;
        if (!taskId) throw new Error('未获取到 Volcengine 任务ID');

        onProgress({ status: 'polling', message: '任务处理中，等待结果...' });

        // Polling Task Status
        const statusEndpoint = (statusUrl || 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/{id}')
            .replace('https://ark.cn-beijing.volces.com', proxyPrefix)
            .replace('{id}', taskId);

        return poll(async (attempt) => {
            onProgress({ status: 'polling', message: `正在轮询生成结果... (${attempt * 5}s)` });

            const statusRes = await fetch(statusEndpoint, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });

            if (!statusRes.ok) {
                const err = await statusRes.json().catch(() => ({}));
                throw new Error(`获取状态失败: ${statusRes.status} ${err.error?.message || err.message || ''}`);
            }

            const data = await statusRes.json();
            const state = data.status; // running, succeed, failed

            if (state === 'succeed') {
                const videoUrl = data.content?.[0]?.video_url || data.content?.[0]?.url;
                if (!videoUrl) throw new Error('任务完成，但未返回视频 URL');
                onProgress({ status: 'success', message: '视频生成成功！' });
                return videoUrl;
            }

            if (state === 'failed') {
                throw new Error(`生成失败: ${data.reason || '未知错误'}`);
            }

            return null;
        }, 5000, 144);

    } else {
        throw new Error(`平台 "${platform}" 的视频 API 尚未接入，敬请期待`);
    }
};

// ── URL extraction from natural-language response content ─────────────────────
function extractVideoUrl(text) {
    if (!text) return null;
    // 1. Direct video file link (.mp4 / .webm / .mov with optional query string)
    const m1 = text.match(/https?:\/\/[^\s)>\]]+\.(?:mp4|webm|mov|m4v)(?:\?[^\s)>\]]*)?/i);
    if (m1) return m1[0];
    // 2. Markdown link  [label](url)
    const m2 = text.match(/\(https?:\/\/[^\s)]+\)/);
    if (m2) return m2[0].slice(1, -1);
    // 3. Any https link as last resort
    const m3 = text.match(/https?:\/\/[^\s)>\]]+/);
    if (m3) return m3[0];
    return null;
}

