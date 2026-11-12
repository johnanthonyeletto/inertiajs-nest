import type { Request } from 'express'
import type { FindOptions, Model, ModelStatic } from 'sequelize'
import type { ProvidesScrollMetadata, ScrollMetadata } from '@johnanthonyeletto/nestjs-inertia'

export interface PaginationLink {
  url: string | null
  label: string
  active: boolean
}

/** A length-aware paginator, serialized for the client and usable as an infinite scroll prop. */
export class Paginator<T> implements ProvidesScrollMetadata {
  constructor(
    readonly data: T[],
    readonly total: number,
    readonly perPage: number,
    readonly currentPage: number,
    private readonly request: Request,
    readonly pageName = 'page',
  ) {}

  get lastPage(): number {
    return Math.max(1, Math.ceil(this.total / this.perPage))
  }

  get hasMorePages(): boolean {
    return this.currentPage < this.lastPage
  }

  map<U>(callback: (item: T) => U): Paginator<U> {
    return new Paginator(this.data.map(callback), this.total, this.perPage, this.currentPage, this.request, this.pageName)
  }

  url(page: number): string {
    const query = new URLSearchParams(this.request.query as Record<string, string>)
    query.set(this.pageName, String(page))

    return `${this.request.path}?${query}`
  }

  toScrollMetadata(): ScrollMetadata {
    return {
      pageName: this.pageName,
      previousPage: this.currentPage > 1 ? this.currentPage - 1 : null,
      nextPage: this.hasMorePages ? this.currentPage + 1 : null,
      currentPage: this.currentPage,
    }
  }

  toJSON() {
    const from = this.total === 0 ? null : (this.currentPage - 1) * this.perPage + 1

    return {
      data: this.data,
      meta: {
        currentPage: this.currentPage,
        lastPage: this.lastPage,
        perPage: this.perPage,
        total: this.total,
        from,
        to: from === null ? null : from + this.data.length - 1,
      },
      links: this.links(),
    }
  }

  private links(): PaginationLink[] {
    const pages: (number | '...')[] = []

    for (let page = 1; page <= this.lastPage; page++) {
      if (page === 1 || page === this.lastPage || Math.abs(page - this.currentPage) <= 2) {
        pages.push(page)
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...')
      }
    }

    return [
      { url: this.currentPage > 1 ? this.url(this.currentPage - 1) : null, label: 'Previous', active: false },
      ...pages.map((page) =>
        page === '...'
          ? { url: null, label: '...', active: false }
          : { url: this.url(page), label: String(page), active: page === this.currentPage },
      ),
      { url: this.hasMorePages ? this.url(this.currentPage + 1) : null, label: 'Next', active: false },
    ]
  }
}

export async function paginate<M extends Model, T>(
  model: ModelStatic<M>,
  request: Request,
  options: FindOptions & { perPage?: number; pageName?: string; serialize: (row: M) => T },
): Promise<Paginator<T>> {
  const { perPage = 10, pageName = 'page', serialize, ...findOptions } = options
  const page = Math.max(1, Number.parseInt(String(request.query[pageName] ?? '1'), 10) || 1)

  const { rows, count } = await model.findAndCountAll({
    ...findOptions,
    limit: perPage,
    offset: (page - 1) * perPage,
    distinct: true,
  })

  return new Paginator(rows.map(serialize), count, perPage, page, request, pageName)
}
