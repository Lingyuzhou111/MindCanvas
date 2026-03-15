import OSS from 'ali-oss';

const API_BASE = '/api/bizyair';

const uploadToBizyAir = async (base64Img, apiKey, onProgress) => {
  onProgress({ status: 'uploading', message: '正在获取上传凭证...' });
  const headers = { "Authorization": `Bearer ${apiKey}` };
  const tokenUrl = `${API_BASE}/x/v1/upload/token?file_name=upload.png&file_type=inputs`;
  
  const resp = await fetch(tokenUrl, { headers });
  if (!resp.ok) throw new Error('获取上传凭证失败: ' + resp.status);
  const tokenData = await resp.json();
  if (!tokenData.status) throw new Error(`获取上传凭证失败: ${tokenData.message}`);
  
  const { file, storage } = tokenData.data;

  // Convert base64 Data URL to Blob
  const blob = await (await fetch(base64Img)).blob();
  
  onProgress({ status: 'uploading', message: '正在直传云端 (OSS)...' });
  const client = new OSS({
    region: 'oss-cn-beijing', // General region used by backend usually
    accessKeyId: file.access_key_id,
    accessKeySecret: file.access_key_secret,
    stsToken: file.security_token,
    bucket: storage.bucket,
    endpoint: storage.endpoint
  });

  await client.put(file.object_key, blob);

  onProgress({ status: 'uploading', message: '正在提交云端资源凭证...' });
  const commitUrl = `${API_BASE}/x/v1/input_resource/commit`;
  const commitResp = await fetch(commitUrl, {
    method: 'POST',
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "upload.png", object_key: file.object_key })
  });
  
  if (!commitResp.ok) throw new Error('提交云端资源失败: ' + commitResp.status);
  const commitData = await commitResp.json();
  if (!commitData.status) throw new Error(`提交资源失败: ${commitData.message}`);
  
  return commitData.data.url;
};

export const generateBizyAirTask = async (apiKey, appConfig, params, onProgress) => {
  if (!apiKey) throw new Error('请先在配置中心填写 BizyAir API Key');

  // 1. Process inputs dynamically using bizyair_apps.json spec
  const input_values = {};
  for (const param of appConfig.parameters) {
    if (param.type === 'constant') {
      input_values[param.key] = param.value || param.source;
    } else if (param.type === 'image_url') {
      const b64 = params[param.source];
      if (!b64) throw new Error(`缺少必要的参考图输入: ${param.label}`);
      input_values[param.key] = await uploadToBizyAir(b64, apiKey, onProgress);
    } else if (param.type === 'resolution') {
        const resMap = { "1K": "1K", "2K": "2K", "4K": "4K", "auto": "auto" };
        input_values[param.key] = resMap[params[param.source]] || "1K";
    } else {
      input_values[param.key] = params[param.source] !== undefined ? params[param.source] : '';
    }
  }

  // 2. Create Workflow Task
  onProgress({ status: 'submitting', message: `启动 ${appConfig.name} 任务...` });
  const createUrl = `${API_BASE}/w/v1/webapp/task/openapi/create`;
  const payload = {
    web_app_id: appConfig.web_app_id,
    suppress_preview_output: true,
    input_values
  };

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  };

  const createResp = await fetch(createUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
  if (!createResp.ok) throw new Error('创建节点任务失败: ' + createResp.status);
  const createData = await createResp.json();
  const requestId = createData.requestId || createData.request_id;
  if (!requestId) throw new Error(`创建任务异常: ${JSON.stringify(createData)}`);

  // 3. Poll Workflow Status
  return await new Promise((resolve, reject) => {
    let pollCount = 0;
    const poll = async () => {
      pollCount++;
      onProgress({ status: 'polling', message: `工作流处理中... (${pollCount * 5}s)`, progress: Math.min(95, pollCount * 5) });
      
      try {
        const statusResp = await fetch(`${API_BASE}/w/v1/webapp/task/openapi/detail?requestId=${requestId}`, { headers });
        if (!statusResp.ok) throw new Error('查询状态失败: ' + statusResp.status);
        const statusData = await statusResp.json();
        const status = statusData.data?.status || 'Unknown';

        if (status === 'Success') {
          // 4. Fetch Final Outputs
          onProgress({ status: 'success', message: '处理完成，提取结果...' });
          const outResp = await fetch(`${API_BASE}/w/v1/webapp/task/openapi/outputs?requestId=${requestId}`, { headers });
          if (!outResp.ok) throw new Error('提取结果失败: ' + outResp.status);
          const outData = await outResp.json();
          const outputs = outData.data?.outputs || [];
          if (outputs.length === 0) throw new Error('任务成功，但未返回任何输出物');
          
          const first = outputs[0];
          if (first.error_type && first.error_type !== 'NOT_ERROR') {
            throw new Error(`执行报错: ${first.error_msg}`);
          }
          if (!first.object_url) throw new Error('返回结果提取不到 URL');
          
          onProgress({ status: 'success', message: '生成成功！', progress: 100 });
          resolve(first.object_url);
        } else if (status === 'Failed' || status === 'Canceled') {
          reject(new Error(`任务已终止，状态: ${status}`));
        } else {
          setTimeout(poll, 5000);
        }
      } catch (e) {
        reject(e);
      }
    };
    setTimeout(poll, 5000);
  });
};
