'use strict';
const { db } = require('@arangodb');
const { context } = require('@arangodb/locals');
const collections = [];

for (const localName of collections) {
  const qualifiedName = context.collectionName(localName);
  db._drop(qualifiedName);
}
