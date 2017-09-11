/* Utilities for accessing the api */
import { contains } from 'underscore';

export const API_ROOT = '/redash/';


function httpPrefixInterceptor($q) {
  return {
    request(config) {
      const url = config.url;

      // ignore template requests
      if (url.substr(url.length - 5) === '.html') {
        return config || $q.when(config);
      }

      // If there is no reference to a service, prepend the redash root
      const EXTERNAL_SERVICES = ['zenodot', 'admissions'];
      let root;
      if (url[0] === '/') {
        root = url.slice(1).split('/')[0];
      } else {
        root = url.split('/')[0];
      }
      if (!contains(EXTERNAL_SERVICES, root)) {
        config.url = API_ROOT + url;
      }
      return config || $q.when(config);
    },
  };
}


export default function configureHttpProvider(ngModule) {
  // Configure to prepend api root
  ngModule.factory('httpPrefixInterceptor', httpPrefixInterceptor);
  ngModule.config(($httpProvider) => {
    $httpProvider.interceptors.push('httpPrefixInterceptor');
  });
}
