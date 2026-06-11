import axiosInstance from './api'

const BASE = '/admin/system-config'

export const systemConfigApi = {
  getAll: () => axiosInstance.get(BASE),
  getByKey: (key) => axiosInstance.get(`${BASE}/${key}`),
  update: (key, configValue) => axiosInstance.put(`${BASE}/${key}`, { configValue }),
}
