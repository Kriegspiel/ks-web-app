import axios from "axios"

const api = axios.create({
  baseURL: "",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
})

function extractMessage(error, fallback) {
  const responseMessage = error?.response?.data?.detail
  if (typeof responseMessage === "string" && responseMessage.trim().length > 0) {
    return responseMessage
  }

  const requestMessage = error?.message
  if (typeof requestMessage === "string" && requestMessage.trim().length > 0) {
    return requestMessage
  }

  return fallback
}

export async function register(payload) {
  try {
    const response = await api.post("/auth/register", payload)
    return response.data
  } catch (error) {
    throw {
      status: error?.response?.status,
      message: extractMessage(error, "Unable to register right now."),
    }
  }
}

export async function login(payload) {
  try {
    const response = await api.post("/auth/login", payload)
    return response.data
  } catch (error) {
    throw {
      status: error?.response?.status,
      message: extractMessage(error, "Unable to login right now."),
    }
  }
}

export async function logout() {
  try {
    await api.post("/auth/logout")
  } catch (error) {
    throw {
      status: error?.response?.status,
      message: extractMessage(error, "Unable to logout right now."),
    }
  }
}

export async function me() {
  try {
    const response = await api.get("/auth/me")
    return response.data
  } catch (error) {
    throw {
      status: error?.response?.status,
      message: extractMessage(error, "Unable to fetch your session."),
    }
  }
}

export default api
