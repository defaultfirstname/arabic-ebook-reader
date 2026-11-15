<script lang="ts">
  import { goto } from '$app/navigation';
  import { getBookHref } from '#lib/data/book-reference';
  import { database } from '#lib/data/store';
  import { formatPageTitle } from '#lib/functions/format-page-title';
  import { observe } from '#lib/functions/rxjs/use-observable';
  import { map, take, tap } from 'rxjs';

  const autoNavigate$ = database.lastItem$.pipe(
    take(1),
    map((lastItem) => (lastItem ? getBookHref(lastItem) : 'manage')),
    tap(goto)
  );
</script>

<svelte:head>
  <title>{formatPageTitle('Home')}</title>
</svelte:head>

<div use:observe={autoNavigate$}></div>
