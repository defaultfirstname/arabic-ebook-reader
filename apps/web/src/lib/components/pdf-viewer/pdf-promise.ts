/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

if (typeof Promise.withResolvers !== 'function') {
  Object.defineProperty(Promise, 'withResolvers', {
    configurable: true,
    writable: true,
    value<T>(this: PromiseConstructor): PromiseWithResolvers<T> {
      let resolve!: PromiseWithResolvers<T>['resolve'];
      let reject!: PromiseWithResolvers<T>['reject'];
      const promise = new this<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      return { promise, resolve, reject };
    }
  });
}
