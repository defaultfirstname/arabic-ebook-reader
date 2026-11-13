/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { booksSchemaVersion, type default as BooksDb } from './versions/books-db';
import { openDB } from 'idb';
import upgradeBooksDbFromV2 from './versions/v2/upgrade';

export function createBooksDb(name = 'books') {
  return openDB<BooksDb>(name, booksSchemaVersion, {
    async upgrade(oldDb, oldVersion, newVersion, transaction) {
      oldDb.createObjectStore('pdfBook', { keyPath: 'id', autoIncrement: true });
      oldDb.createObjectStore('pdfFile');

      switch (oldVersion) {
        case 0: {
          const dataStore = oldDb.createObjectStore('data', {
            keyPath: 'id',
            autoIncrement: true
          });
          dataStore.createIndex('title', 'title');

          oldDb.createObjectStore('bookmark', {
            keyPath: 'dataId'
          });

          oldDb.createObjectStore('lastItem');

          oldDb.createObjectStore('storageSource', {
            keyPath: 'name'
          });

          const statisticsStore = oldDb.createObjectStore('statistic', {
            keyPath: ['title', 'dateKey']
          });

          statisticsStore.createIndex('dateKey', 'dateKey');
          statisticsStore.createIndex('completedBook', ['completedBook', 'title']);

          const readingGoalsStore = oldDb.createObjectStore('readingGoal', {
            keyPath: 'goalStartDate'
          });

          readingGoalsStore.createIndex('goalEndDate', 'goalEndDate');

          oldDb.createObjectStore('lastModified', {
            keyPath: ['title', 'dataType']
          });

          oldDb.createObjectStore('audioBook', { keyPath: 'title' });

          oldDb.createObjectStore('subtitle', { keyPath: 'title' });

          oldDb.createObjectStore('handle', { keyPath: ['title', 'dataType'] });

          break;
        }
        case 2: {
          await upgradeBooksDbFromV2(oldDb, oldVersion, newVersion, transaction);
        }
        // Falls through to add stores introduced after v3.
        case 3: {
          oldDb.createObjectStore('storageSource', {
            keyPath: 'name'
          });
        }
        // Falls through to add stores introduced after v4.
        case 4: {
          const statisticsStore = oldDb.createObjectStore('statistic', {
            keyPath: ['title', 'dateKey']
          });

          statisticsStore.createIndex('dateKey', 'dateKey');
          statisticsStore.createIndex('completedBook', ['completedBook', 'title']);

          const readingGoalsStore = oldDb.createObjectStore('readingGoal', {
            keyPath: 'goalStartDate'
          });

          readingGoalsStore.createIndex('goalEndDate', 'goalEndDate');

          oldDb.createObjectStore('lastModified', {
            keyPath: ['title', 'dataType']
          });
        }
        // Falls through to add stores introduced after v5.
        case 5: {
          oldDb.createObjectStore('audioBook', { keyPath: 'title' });

          oldDb.createObjectStore('subtitle', { keyPath: 'title' });

          oldDb.createObjectStore('handle', { keyPath: ['title', 'dataType'] });

          break;
        }
      }
    }
  });
}
