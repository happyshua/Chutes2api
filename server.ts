// server.ts - Deno version of Chutes2API proxy

import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";

// 模型映射字典
const MODEL_MAPPING: Record<string, string> = {
  "nvidia/Llama-3.1-405B-Instruct-FP8": "chutes-nvidia-llama-3-1-405b-instruct-fp8",
  "deepseek-ai/DeepSeek-R1": "chutes-deepseek-ai-deepseek-r1",
  "Qwen/Qwen2.5-72B-Instruct": "chutes-qwen-qwen2-5-72b-instruct",
  "Qwen/Qwen2.5-Coder-32B-Instruc": "chutes-qwen-qwen2-5-coder-32b-instruct",
  "bytedance-research/UI-TARS-72B-DPO": "chutes-bytedance-research-ui-tars-72b-dpo",
  "OpenGVLab/InternVL2_5-78B": "chutes-opengvlab-internvl2-5-78b",
  "hugging-quants/Meta-Llama-3.1-70B-Instruct-AWQ-INT4": "chutes-hugging-quants-meta-llama-3-1-70b-instruct-awq-int4",
  "NousResearch/Hermes-3-Llama-3.1-8B": "cxmplexbb-nousresearch-hermes-3-llama-3-1-8b",
  "Qwen/QVQ-72B-Preview": "chutes-qwen-qvq-72b-preview",
  "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B": "chutes-deepseek-ai-deepseek-r1-distill-qwen-32b",
  "jondurbin/bagel-8b-v1.0": "chutes-jondurbin-bagel-8b-v1-0",
  "unsloth/QwQ-32B-Preview": "cxmplexbb-unsloth-qwq-32b-preview",
  "Qwen/QwQ-32B-Preview": "chutes-qwq-32b-preview",
  "jondurbin/airoboros-34b-3.3": "chutes-jondurbin-airoboros-34b-3-3",
  "NovaSky-AI/Sky-T1-32B-Preview": "chutes-novasky-ai-sky-t1-32b-preview",
  "driaforall/Dria-Agent-a-3B": "chutes-driaforall-dria-agent-a-3b",
  "NousResearch/Nous-Hermes-Llama2-13b": "cxmplexbb-nousresearch-nous-hermes-llama2-13b",
  "unsloth/Llama-3.2-1B-Instruct": "chutes-unsloth-llama-3-2-1b-instruct"
};

// Create application
const app = new Application();
const router = new Router();

// 检查认证
function checkAuth(request: Request): boolean {
  const authToken = Deno.env.get("AUTH_TOKEN");
  if (!authToken) {
    return true;
  }
  
  const authHeader = request.headers.get("Authorization") || "";
  return authHeader === `Bearer ${authToken}`;
}

// 创建Chutes请求
function createChutesRequest(openaiRequest: any): any {
  const messages = openaiRequest.messages;
  const messageId = crypto.randomUUID();
  const currentTime = new Date().toISOString();
  
  const model = openaiRequest.model || "deepseek-ai/DeepSeek-R1";
  const chuteName = MODEL_MAPPING[model] || "chutes-deepseek-ai-deepseek-r1";
  
  return {
    messages: [{
      role: messages[messages.length - 1].role,
      content: messages[messages.length - 1].content,
      id: messageId,
      createdOn: currentTime
    }],
    model: model,
    chuteName: chuteName
  };
}

// 处理响应数据块
function processChunk(chunk: any): string | null {
  try {
    if (chunk.choices && chunk.choices[0]?.delta?.content) {
      return chunk.choices[0].delta.content;
    }
    return null;
  } catch {
    return null;
  }
}

// 添加CORS - 允许所有来源、方法和头部
app.use(oakCors({
  origin: "*",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  preflightContinue: false,
  optionsSuccessStatus: 204,
  allowedHeaders: "*",
  credentials: true
}));

// 健康检查端点
router.get("/", (ctx) => {
  ctx.response.body = { 
    status: "Chutes API Service Running", 
    version: "1.0" 
  };
});

// 获取可用模型列表
router.get("/v1/models", (ctx) => {
  if (!checkAuth(ctx.request)) {
    ctx.response.status = 401;
    ctx.response.body = "Unauthorized";
    return;
  }
  
  const models = Object.keys(MODEL_MAPPING).map(modelId => ({
    id: modelId,
    object: "model",
    created: Math.floor(Date.now() / 1000),
    owned_by: "chutes"
  }));
  
  ctx.response.body = {
    object: "list",
    data: models
  };
});

// 聊天完成接口
router.post("/v1/chat/completions", async (ctx) => {
  try {
    if (!checkAuth(ctx.request)) {
      ctx.response.status = 401;
      ctx.response.body = "Unauthorized";
      return;
    }
    
    const openaiRequest = await ctx.request.body.json();
    const chutesRequest = createChutesRequest(openaiRequest);
    
    const headers = {
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Content-Type": "text/plain;charset=UTF-8",
      "Origin": "https://chutes.ai",
      "Pragma": "no-cache",
      "Referer": "https://chutes.ai/",
      "Sec-Ch-Ua": '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Linux"',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    };
    
    const response = await fetch("https://chutes.ai/app/api/chat", {
      method: "POST",
      headers: headers,
      body: JSON.stringify(chutesRequest)
    });
    
    if (!response.ok) {
      ctx.response.status = response.status;
      ctx.response.body = `Chutes API error: ${await response.text()}`;
      return;
    }
    
    // 处理流式请求
    if (openaiRequest.stream) {
      ctx.response.headers.set("Content-Type", "text/event-stream");
      ctx.response.headers.set("Access-Control-Allow-Origin", "*");
      ctx.response.headers.set("Cache-Control", "no-cache");
      ctx.response.headers.set("Connection", "keep-alive");
      
      const reader = response.body?.getReader();
      if (!reader) {
        ctx.response.status = 500;
        ctx.response.body = "Failed to get response reader";
        return;
      }
      
      // 创建转换流并处理
      const textDecoder = new TextDecoder();
      let buffer = "";
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                controller.enqueue("data: [DONE]\n\n");
                controller.close();
                break;
              }
              
              buffer += textDecoder.decode(value, { stream: true });
              
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";
              
              for (const line of lines) {
                if (line.trim() === "") continue;
                
                if (line.startsWith("data: ")) {
                  const data = line.substring(6);
                  
                  if (data === "[DONE]") {
                    controller.enqueue("data: [DONE]\n\n");
                    continue;
                  }
                  
                  try {
                    const chunk = JSON.parse(data);
                    const content = processChunk(chunk);
                    
                    if (content) {
                      const responseChunk = {
                        id: crypto.randomUUID(),
                        object: "chat.completion.chunk",
                        created: Math.floor(Date.now() / 1000),
                        model: chutesRequest.model,
                        choices: [{
                          delta: {
                            content: content
                          },
                          index: 0,
                          finish_reason: null
                        }]
                      };
                      
                      controller.enqueue(`data: ${JSON.stringify(responseChunk)}\n\n`);
                    }
                  } catch (e) {
                    console.error("Error processing chunk:", e);
                    continue;
                  }
                }
              }
            }
          } catch (error) {
            console.error("Stream processing error:", error);
            controller.error(error);
          }
        }
      });
      
      ctx.response.body = stream;
    } else {
      // 处理非流式请求
      const text = await response.text();
      let fullContent = "";
      
      // 解析响应
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.substring(6);
          
          if (data === "[DONE]") {
            break;
          }
          
          try {
            const chunk = JSON.parse(data);
            const content = processChunk(chunk);
            if (content) {
              fullContent += content;
            }
          } catch (e) {
            continue;
          }
        }
      }
      
      if (!fullContent) {
        ctx.response.status = 500;
        ctx.response.body = "Empty response from server";
        return;
      }
      
      ctx.response.body = {
        id: crypto.randomUUID(),
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: chutesRequest.model,
        choices: [{
          message: {
            role: "assistant",
            content: fullContent
          },
          finish_reason: "stop",
          index: 0
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
    }
  } catch (error) {
    console.error("Error in chat endpoint:", error);
    ctx.response.status = 500;
    ctx.response.body = `Internal server error: ${error.message}`;
  }
});

// 添加OPTIONS预检请求处理
router.options("/(.*)", (ctx) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  ctx.response.headers.set("Access-Control-Allow-Headers", "*");
  ctx.response.headers.set("Access-Control-Max-Age", "86400");
  ctx.response.status = 204;
});

// 应用路由
app.use(router.routes());
app.use(router.allowedMethods());

// 启动服务
const port = Number(Deno.env.get("PORT") || "8805");
console.log(`Starting server on port ${port}...`);

app.addEventListener("listen", ({ port }) => {
  console.log(`Server is running on http://localhost:${port}`);
});

await app.listen({ port });

