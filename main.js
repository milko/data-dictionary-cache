'use strict';
const { context } = require('@arangodb/locals');

context.use('/test', require('./routes/test'), 'test');
