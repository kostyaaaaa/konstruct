import axios from 'axios';

const BASE_URL = process.env.DOTA_API_URL;

const instance = axios.create({
  baseURL: BASE_URL,
});

export default instance;
