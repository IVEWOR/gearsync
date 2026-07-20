import axios from "axios";
import { getBaseUrl } from "./constants.js";
import { getAccessToken } from "./auth.js";

export function createAmazonClient(refreshToken) {
  const instance = axios.create({ baseURL: getBaseUrl() });

  instance.interceptors.request.use(async (config) => {
    const token = await getAccessToken(refreshToken);
    config.headers["x-amz-access-token"] = token;
    config.headers["Content-Type"] = "application/json";
    return config;
  });

  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 429) {
        const retryErr = new Error("Amazon rate limit (429)");
        retryErr.retryable = true;
        throw retryErr;
      }
      throw err;
    },
  );

  return instance;
}
