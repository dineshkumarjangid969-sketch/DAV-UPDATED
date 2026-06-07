import axios from "axios";

const API = axios.create({
  baseURL: `http://${window.location.hostname}:5000/api`,
});

export default API;
