export class QueryPromise<T> implements PromiseLike<T> {
  private promise: Promise<T>;
  
  constructor(promise: Promise<T>) {
    this.promise = promise;
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.promise.then(onfulfilled, onrejected);
  }

  sort(options: any) {
    this.promise = this.promise.then((results: any) => {
      if (Array.isArray(results)) {
        const key = Object.keys(options)[0];
        const direction = options[key];
        return [...results].sort((a: any, b: any) => {
          let valA = a[key];
          let valB = b[key];
          
          if (valA instanceof Date) valA = valA.getTime();
          if (valB instanceof Date) valB = valB.getTime();

          if (typeof valA === 'string' && typeof valB === 'string') {
            return direction === -1 
              ? valB.localeCompare(valA)
              : valA.localeCompare(valB);
          }
          
          return direction === -1
            ? (valB > valA ? 1 : -1)
            : (valA > valB ? 1 : -1);
        });
      }
      return results;
    });
    return this;
  }

  populate(path: any, select?: any) {
    // no-op, relations are already eagerly loaded in Prisma config
    return this;
  }
}
