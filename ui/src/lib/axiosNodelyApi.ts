import Axios from 'axios'
import queryString from 'query-string'

const instance = Axios.create({
  baseURL: 'https://afmetrics.api.nodely.io',
  paramsSerializer: (params) => queryString.stringify(params),
})
const axiosNodelyApi = instance

export default axiosNodelyApi
