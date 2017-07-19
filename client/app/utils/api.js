/* Utilities for accessing the api */

export const API_ROOT = '/redash/';


function httpPrefixInterceptor($q) {
  return {
    request(config) {
      const url = config.url;

      // ignore template requests
      if (url.substr(url.length - 5) === '.html') {
        return config || $q.when(config);
      }

      config.url = API_ROOT + config.url;
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
