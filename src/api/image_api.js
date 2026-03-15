// API Integration for Multiple Platforms

import ratioMap from '../../config/ratio_map.json';

const compressImage = (base64Str, maxSize = 1024) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxSize && height <= maxSize) {
        resolve(base64Str);
        return;
      }
      if (width > height) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('图片加载压缩失败'));
    img.src = base64Str;
  });
};

const getResolutionString = (resolution, ratio, separator = '*') => {
  let resKey = '1k_ratios';
  if (resolution === '1.5K') resKey = '1.5k_ratios';
  else if (resolution === '2K') resKey = '2k_ratios';
  else if (resolution === '4K') resKey = '4k_ratios';

  const dims = ratioMap[resKey]?.[ratio] || ratioMap['1k_ratios']['1:1'];
  return `${dims.width}${separator}${dims.height}`;
};

export const generateImage = async (apiKey, prompt, params, onProgress) => {
  const { ratio = '1:1', resolution = '1K', platform, model, endpoint } = params;

  if (!apiKey) {
    throw new Error(`请先在设置中配置 ${platform} API Key`);
  }

  onProgress({ status: 'submitting', message: '正在提交任务...' });

  let processedImages = [];
  if (params.inputImages && params.inputImages.length > 0) {
    onProgress({ status: 'compressing', message: '正在处理并压缩参考图像...' });
    for (const imgObj of params.inputImages) {
      try {
        // Ensure we handle both raw strings and object format { url, ... }
        const rawUrl = typeof imgObj === 'string' ? imgObj : imgObj?.url;
        if (!rawUrl) continue;

        const compressed = await compressImage(rawUrl, 1024);
        processedImages.push(compressed);
      } catch (e) {
        console.warn('Image compression failed', e);
      }
    }
  }

  // Filter out images for non-supported models on Aliyun and ModelScope
  let finalInputImages = processedImages;
  if (platform === 'Aliyun' && !model.toLowerCase().includes('qwen-image')) {
    finalInputImages = [];
  } else if (platform === 'ModelScope' && !(/edit|i2i|img2img|image2image|controlnet|adapter/i.test(model))) {
    finalInputImages = [];
  }

  try {
    if (platform === 'SiliconFlow') {
      // --- SiliconFlow API (Synchronous) ---
      // example: /v1/images/generations
      const requestBody = {
        model: model, // e.g., "Kwai-Kolors/Kolors"
        prompt: prompt,
        size: getResolutionString(resolution, ratio, 'x'), // "1024x1024"
        n: 1,
        // extra_body: { step: 20 }
      };
      if (finalInputImages.length > 0) {
        requestBody.image = finalInputImages[0];
      }

      const response = await fetch('/api/siliconflow/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`SiliconFlow 生成失败: ${response.status} ${errData.message || ''}`);
      }

      const data = await response.json();
      if (data.images && data.images.length > 0) {
        onProgress({ status: 'success', message: '生成成功！', progress: 100 });
        return data.images[0].url; // e.g. OpenAI format
      } else if (data.data && data.data.length > 0) {
        onProgress({ status: 'success', message: '生成成功！', progress: 100 });
        return data.data[0].url;
      }
      throw new Error('生成成功，但未返回图片链接。');

    } else if (platform === 'Aliyun') {
      // --- Aliyun API (Synchronous Multimodal) ---
      const requestBody = {
        model: model, // e.g., "qwen-image-2.0-pro"
        input: {
          messages: [
            {
              role: "user",
              content: [
                ...finalInputImages.map(img => ({ image: img })),
                { text: prompt }
              ]
            }
          ]
        },
        parameters: {
          size: getResolutionString(resolution, ratio, '*')
        }
      };

      const response = await fetch('/api/aliyun/api/v1/services/aigc/multimodal-generation/generation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Aliyun 请求失败: ${response.status} ${errData.message || ''}`);
      }

      const data = await response.json();

      // Since async is disabled, it must return synchronously
      if (data.output && data.output.choices) {
        onProgress({ status: 'success', message: '生成成功！', progress: 100 });
        const content = data.output.choices[0].message.content;
        const imgNode = content.find(c => c.image);
        if (imgNode) return imgNode.image;
        throw new Error('未在返回体中找到图片');
      }

      throw new Error('Aliyun 未返回预期的同步结果');

    } else if (platform === 'T8star') {
      // --- T8star API (OpenAI Chat Format) ---
      const t8starContent = finalInputImages.length > 0
        ? [
          ...finalInputImages.map(img => ({ type: "image_url", image_url: { url: img } })),
          { type: "text", text: prompt }
        ]
        : prompt;

      const requestBody = {
        model: model,
        messages: [{ role: "user", content: t8starContent }]
      };

      const response = await fetch('/api/t8star/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`T8star 请求失败: ${response.status} ${errData.error?.message || ''}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      // Extraction: Look for markdown image ![alt](url) or pure http url
      const urlMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/) || content.match(/(https?:\/\/[^\s\)]+)/);
      if (urlMatch && urlMatch[1]) {
        onProgress({ status: 'success', message: '生成成功！', progress: 100 });
        return urlMatch[1];
      }
      throw new Error('未在 T8star 返回中解析到图片 URL');

    } else if (platform === 'ModelScope') {
      // --- ModelScope API (Default / Async Polling) ---
      const requestBody = {
        model: model || 'Tongyi-MAI/Z-Image-Turbo',
        prompt: prompt,
        parameters: {
          size: getResolutionString(resolution, ratio, '*'),
        }
      };
      if (finalInputImages.length > 0) {
        requestBody.input = requestBody.input || {};
        requestBody.input.image = finalInputImages[0];
      }

      const submitResponse = await fetch('/api/modelscope/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-ModelScope-Async-Mode': 'true',
        },
        body: JSON.stringify(requestBody),
      });

      if (!submitResponse.ok) {
        const errData = await submitResponse.json().catch(() => ({}));
        throw new Error(`ModelScope 提交失败: ${submitResponse.status} ${errData.message || ''}`);
      }

      const submitData = await submitResponse.json();
      const taskId = submitData.task_id;
      if (!taskId) throw new Error('ModelScope 未获取到 Task ID');

      return await new Promise((resolve, reject) => {
        let pollCount = 0;
        const poll = async () => {
          pollCount++;
          onProgress({ status: 'polling', message: `正在生成中... (${pollCount * 5}s)`, progress: Math.min(95, pollCount * 5) });

          try {
            const statusResponse = await fetch(`/api/modelscope/v1/tasks/${taskId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'X-ModelScope-Task-Type': 'image_generation',
              },
            });

            if (!statusResponse.ok) throw new Error(`状态查询失败: ${statusResponse.status}`);
            const statusData = await statusResponse.json();

            if (statusData.task_status === 'SUCCEED') {
              if (statusData.output_images && statusData.output_images.length > 0) {
                onProgress({ status: 'success', message: '生成成功！', progress: 100 });
                resolve(statusData.output_images[0]);
              } else {
                reject(new Error('生成成功，但未返回图片链接。'));
              }
            } else if (statusData.task_status === 'FAILED') {
              reject(new Error(`生成失败: ${statusData.message || '未知错误'}`));
            } else {
              setTimeout(poll, 5000);
            }
          } catch (pollErr) {
            reject(pollErr);
          }
        };
        setTimeout(poll, 5000);
      });
    } else {
      // --- Generic ThirdParty API (OpenAI Compatible) ---
      if (!endpoint) {
        throw new Error(`${platform} 未配置 base_url`);
      }

      const isChatFormat = endpoint.includes('chat/completions');

      if (isChatFormat) {
        // Chat completions format for image generation
        const chatContent = finalInputImages.length > 0
          ? [
            ...finalInputImages.map(img => ({ type: "image_url", image_url: { url: img } })),
            { type: "text", text: `${prompt}\n(尺寸: ${getResolutionString(resolution, ratio, 'x')})` }
          ]
          : `${prompt}\n(尺寸: ${getResolutionString(resolution, ratio, 'x')})`;

        const requestBody = {
          model: model,
          messages: [{ role: "user", content: chatContent }]
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(`${platform} 请求失败: ${response.status} ${errData.error?.message || ''}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        const urlMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/) || content.match(/(https?:\/\/[^\s\)]+)/);
        if (urlMatch && urlMatch[1]) {
          onProgress({ status: 'success', message: '生成成功！', progress: 100 });
          return urlMatch[1];
        }
        throw new Error(`未在 ${platform} 返回中解析到图片 URL`);

      } else {
        // Standard OpenAI /images/generations format
        const requestBody = {
          model: model,
          prompt: prompt,
          size: getResolutionString(resolution, ratio, 'x'),
          n: 1,
        };
        if (finalInputImages.length > 0) {
          requestBody.image = finalInputImages[0];
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(`${platform} 生成失败: ${response.status} ${errData.error?.message || errData.message || ''}`);
        }

        const data = await response.json();
        if (data.images && data.images.length > 0) {
          onProgress({ status: 'success', message: '生成成功！', progress: 100 });
          return data.images[0].url;
        } else if (data.data && data.data.length > 0) {
          onProgress({ status: 'success', message: '生成成功！', progress: 100 });
          return data.data[0].url;
        }
        throw new Error('生成成功，但未返回图片链接。');
      }
    }

  } catch (error) {
    console.error(`[${platform || 'ModelScope'}] Generation Error:`, error);
    throw error;
  }
};
