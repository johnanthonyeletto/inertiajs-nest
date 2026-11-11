import { Link } from '@inertiajs/react'
import { PageHeader } from '@/Components/Demo'
import Pagination from '@/Components/Pagination'
import SearchFilter from '@/Components/SearchFilter'
import type { Organization, Paginated } from '@/types/global'

interface Props {
  filters: { search: string; trashed: string }
  organizations: Paginated<Organization>
}

export default function Index({ filters, organizations }: Props) {
  return (
    <>
      <PageHeader
        title="Organizations"
        description="Server-side search, soft-delete filters, and pagination over a Sequelize model."
        actions={
          <Link href="/organizations/create" className="btn-primary">
            New organization
          </Link>
        }
      />
      <SearchFilter url="/organizations" filters={filters} only={['organizations']} />

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">City</th>
              <th className="px-6 py-3">Phone</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {organizations.data.map((organization) => (
              <tr key={organization.id} className="hover:bg-slate-50">
                <td className="px-6 py-3">
                  <Link href={`/organizations/${organization.id}/edit`} prefetch className="font-medium text-slate-900 hover:text-indigo-600">
                    {organization.name}
                  </Link>
                  {organization.deletedAt && <span className="ml-2 text-xs text-rose-500">(deleted)</span>}
                </td>
                <td className="px-6 py-3 text-slate-600">{organization.city}</td>
                <td className="px-6 py-3 text-slate-600">{organization.phone}</td>
              </tr>
            ))}
            {organizations.data.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                  No organizations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
        <span>
          {organizations.meta.from ?? 0}–{organizations.meta.to ?? 0} of {organizations.meta.total}
        </span>
        <Pagination links={organizations.links} />
      </div>
    </>
  )
}
