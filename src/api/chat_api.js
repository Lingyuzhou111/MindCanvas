// Easy Canvas/src/api/chat_api.js

/**
 * Executes a chat completion request to an OpenAI-compatible API.
 * 
 * @param {Object} params - The request parameters
 * @param {string} params.endpoint - The full URL endpoint (e.g. https://api.siliconflow.cn/v1/chat/completions)
 * @param {string} params.apiKey - The authentication token
 * @param {string} params.model - The selected model ID
 * @param {string} params.systemPrompt - The system prompt
 * @param {string} params.userPrompt - The user prompt
 * @param {number} params.maxTokens - Max tokens parameter
 * @param {number} params.temperature - Temperature parameter
 * @param {number} params.topP - Top_p parameter
 * @param {Function} [params.onPartialResponse] - Callback for streaming text updates
 * @returns {Promise<string>} The final complete response string
 */
export async function generateChat({
    endpoint,
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    images = [],
    maxTokens,
    temperature,
    topP,
    onPartialResponse
}) {
    if (!apiKey) {
        throw new Error('当前平台未配置 API Key');
    }

    const messages = [];
    if (systemPrompt && systemPrompt.trim() !== '') {
        messages.push({ role: 'system', content: systemPrompt });
    }
    if (images && images.length > 0) {
        const userContent = [{ type: 'text', text: userPrompt }];
        images.forEach(imgDataUrl => {
            userContent.push({
                type: 'image_url',
                image_url: { url: imgDataUrl }
            });
        });
        messages.push({ role: 'user', content: userContent });
    } else {
        messages.push({ role: 'user', content: userPrompt });
    }

    const payload = {
        model: model,
        messages: messages,
        max_tokens: Number(maxTokens),
        temperature: Number(temperature),
        top_p: Number(topP),
        stream: true // 强制开启流式返回
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errorText = await response.text();
            try {
                const errObj = JSON.parse(errorText);
                errorText = errObj.error?.message || errorText;
            } catch (e) { }
            throw new Error(`API 请求失败 (状态码: ${response.status}): ${errorText}`);
        }

        // 检查响应类型（部分网关在 stream: true 时仍可能返回 application/json）
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            // 非流式回退
            const data = await response.json();
            if (data.choices && data.choices.length > 0) {
                const content = data.choices[0].message?.content || '';
                if (onPartialResponse) onPartialResponse(content);
                return content;
            }
            throw new Error('未返回任何内容');
        }

        // 处理 SSE 流
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullText = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');

            // 保留最后一个不完整的行在 buffer 中，不参与本轮解析
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data:')) continue;

                const dataStr = trimmed.slice(5).trim();
                if (dataStr === '[DONE]') continue;

                try {
                    const data = JSON.parse(dataStr);
                    // 仅解析 OpenAI 兼容格式的 chunk
                    if (data.choices && data.choices.length > 0) {
                        const delta = data.choices[0].delta || {};
                        if (delta.content) {
                            fullText += delta.content;
                            if (onPartialResponse) {
                                onPartialResponse(fullText);
                            }
                        }
                    }
                } catch (e) {
                    // 忽略不完整的或无法解析的 JSON block
                    console.warn("SSE Chunk Parse Error", dataStr);
                }
            }
        }

        return fullText;

    } catch (error) {
        if (error.name === 'AbortError') throw error;
        throw new Error(error.message || '网络连接或请求失败');
    }
}
