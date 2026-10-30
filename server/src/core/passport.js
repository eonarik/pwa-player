// server/src/core/passport.js

import passport from 'passport';
import { yandexStrategy, serializeUser, deserializeUser } from './providers/yandex.js';

passport.use('yandex', yandexStrategy);
passport.serializeUser(serializeUser);
passport.deserializeUser(deserializeUser);

export { passport };
