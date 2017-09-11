import debug from 'debug';
import { API_ROOT } from '../utils/api';

const logger = debug('redash:auth');
const SESSION_ITEM = 'session';
const session = { loaded: false };
const JWT_ITEM = 'jwt';
const COUNTDOWN_THRESHOLD = 300;

function storeSession(sessionData) {
  logger('Updating session to be:', sessionData);
  Object.assign(session, sessionData, { loaded: true });
}

function getLocalSessionData() {
  if (session.loaded) {
    return session;
  }

  const sessionData = window.sessionStorage.getItem(SESSION_ITEM);
  if (sessionData) {
    storeSession(JSON.parse(sessionData));
  }

  return session;
}

function AuthService($window, $location, $q, $http, toastr) {
  const authState = {
    idleToast: null,
    countdown: null,
  };
  const Auth = {
    isAuthenticated() {
      const sessionData = getLocalSessionData();
      return sessionData.loaded && sessionData.user.id;
    },
    login() {
      let next = encodeURI($location.url());
      if (next[0] === '/') {
        next = next.substr(1);
      }
      next = API_ROOT + next;
      logger('Calling login with next = %s', next);
      window.location.href = `/login?next=${next}`;
    },
    logout() {
      logger('Logout.');
      window.sessionStorage.removeItem(SESSION_ITEM);
      $window.location.href = 'logout';
    },
    keepalive() {
      logger('requested to keepalive session');
      return $http.post('/admissions/api/v1/keepalive')
      .then((response) => {
        window.sessionStorage.setItem('jwt', response.data.jwt);
      });
    },
    loadSession() {
      logger('Loading session');
      const sessionData = getLocalSessionData();
      if (sessionData.loaded && sessionData.user.id) {
        logger('Resolving with local value.');
        return $q.resolve(sessionData);
      }

      this.setApiKey(null);
      return $http.get('api/session').then((response) => {
        storeSession(response.data);
        return session;
      });
    },
    loadConfig() {
      logger('Loading config');
      return $http.get('/api/config').then((response) => {
        storeSession({ client_config: response.data.client_config, user: { permissions: [] } });
        return response.data;
      });
    },
    setApiKey(apiKey) {
      logger('Set API key to: %s', apiKey);
      this.apiKey = apiKey;
    },
    getApiKey() {
      return this.apiKey;
    },
    getJwt() {
      return window.sessionStorage.getItem(JWT_ITEM);
    },

    // Idle event handlers, for autologout UX
    onIdleEnd() {
      logger('Idle ended');
      if (authState.idleToast) {
        toastr.remove(authState.idleToast.toastId);
        authState.idleToast = null;
      }
    },
    onSessionTimeout() {
      logger('User session timed out');
      if (authState.idleToast) {
        toastr.remove(authState.idleToast.toastId);
        authState.idleToast = null;
      }
      toastr.error(
        'Your session has timedout due to inactivity. Login again to continue working.',
        'Session timedout',
        {
          timeOut: null,
        }
      );
    },
    onSessionTimeoutWarning(e, countdown) {
      logger('Session timeout countdown:', countdown, 'seconds');
      if (countdown > COUNTDOWN_THRESHOLD) {
        // Don't do anything until we are below the threshold
        return;
      }

      authState.countdown = countdown;
      const toastMsg = `Your session will be expired in ${authState.countdown} seconds due to inactivity.`;
      if (!authState.idleToast) {
        authState.idleToast = toastr.warning(
          toastMsg,
          'Warning',
          {
            timeOut: null,
          }
        );
      } else {
        authState.idleToast.scope.$apply(() => {
          authState.idleToast.scope.message = toastMsg;
        });
      }
    },
  };

  return Auth;
}

function CurrentUserService() {
  const sessionData = getLocalSessionData();
  Object.assign(this, sessionData.user);

  this.canEdit = (object) => {
    const userId = object.user_id || (object.user && object.user.id);
    return this.hasPermission('admin') || (userId && (userId === this.id));
  };

  this.hasPermission = permission => this.permissions.indexOf(permission) !== -1;

  this.isAdmin = this.hasPermission('admin');
}

function ClientConfigService() {
  Object.assign(this, getLocalSessionData().client_config);
}

function apiKeyHttpInterceptor($injector) {
  return {
    request(config) {
      const Auth = $injector.get('Auth');
      const apiKey = Auth.getApiKey();
      if (apiKey) {
        config.headers.Authorization = `Key ${apiKey}`;
      }

      return config;
    },
  };
}

function jwtHttpInterceptor() {
  return {
    request(config) {
      const jwt = window.sessionStorage.getItem(JWT_ITEM);
      if (jwt) {
        config.headers.Authorization = `Bearer ${jwt}`;
      }

      return config;
    },
  };
}

export default function (ngModule) {
  ngModule.factory('Auth', AuthService);
  ngModule.service('currentUser', CurrentUserService);
  ngModule.service('clientConfig', ClientConfigService);
  ngModule.factory('apiKeyHttpInterceptor', apiKeyHttpInterceptor);
  ngModule.factory('jwtHttpInterceptor', jwtHttpInterceptor);

  ngModule.config(($httpProvider, IdleProvider, KeepaliveProvider) => {
    $httpProvider.interceptors.push('apiKeyHttpInterceptor');
    $httpProvider.interceptors.push('jwtHttpInterceptor');

    // configure idle warnings
    // 5 second idling threshold: 5 seconds of inactivity triggers idle state
    // 15 minute idling timeout
    // 5 minute keepalive ping interval
    IdleProvider.idle(5);
    IdleProvider.timeout(900);
    KeepaliveProvider.interval(300);
  });

  ngModule.run(($location, $window, $rootScope, $route, Auth, Idle) => {
    $rootScope.$on('$routeChangeStart', (event, to) => {
      if (to.authenticated && !Auth.isAuthenticated()) {
        logger('Requested authenticated route: ', to);
        event.preventDefault();
        // maybe we only miss the session? try to load session
        Auth.loadSession().then(() => {
          logger('Loaded session');
          $route.reload();
        }).catch(() => {
          logger('Need to login, redirecting');
          Auth.login();
        });
      }
    });

    // Start the idle watcher
    Idle.watch();
    // Register handlers for idle watching events
    $rootScope.$on('IdleStart', Auth.keepalive.bind(Auth));
    $rootScope.$on('IdleEnd', Auth.onIdleEnd.bind(Auth));
    $rootScope.$on('IdleTimeout', Auth.onSessionTimeout.bind(Auth));
    $rootScope.$on('IdleWarn', Auth.onSessionTimeoutWarning.bind(Auth));
    $rootScope.$on('Keepalive', Auth.keepalive.bind(Auth));
  });
}
