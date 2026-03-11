export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

export const API_URLS = {
  registerUser: '/api/user/register',
  updateHospital: (id: string | number) => `/api/hospital/update/${id}`,
  updateUser: (id: string | number) => `/api/user/update/${id}`,
} as const;

export const makeUrl = (path: string) =>
  new URL(path, API_BASE_URL).toString();
