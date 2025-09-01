import { SageMakerRuntimeClient, InvokeEndpointCommand } from "@aws-sdk/client-sagemaker-runtime";

const region = process.env.AWS_REGION || "us-east-1";
const endpointName = process.env.SM_EMBEDDINGS_ENDPOINT;

if (!endpointName) {
  console.warn("SM_EMBEDDINGS_ENDPOINT is not set; embedBuffer will throw if called.");
}

const smr = new SageMakerRuntimeClient({ region });

export async function embedBuffer(buffer) {
  if (!endpointName) throw new Error("SM_EMBEDDINGS_ENDPOINT is not configured");
  const res = await smr.send(new InvokeEndpointCommand({
    EndpointName: endpointName,
    ContentType: "application/x-image",
    Accept: "application/json",
    Body: buffer
  }));
  // res.Body is a Uint8Array in Node 18+
  const text = Buffer.from(res.Body).toString();
  return JSON.parse(text);
}


