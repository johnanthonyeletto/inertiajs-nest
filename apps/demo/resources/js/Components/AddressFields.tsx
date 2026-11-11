import { SelectInput, TextInput } from './Fields'

type AddressKey = 'email' | 'phone' | 'address' | 'city' | 'region' | 'country' | 'postalCode'

interface Props {
  data: Record<AddressKey, string>
  errors: Partial<Record<string, string>>
  setData: (key: AddressKey, value: string) => void
}

export default function AddressFields({ data, errors, setData }: Props) {
  return (
    <>
      <TextInput label="Email" name="email" type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} error={errors.email} />
      <TextInput label="Phone" name="phone" value={data.phone} onChange={(e) => setData('phone', e.target.value)} error={errors.phone} />
      <TextInput label="Address" name="address" value={data.address} onChange={(e) => setData('address', e.target.value)} error={errors.address} className="sm:col-span-2" />
      <TextInput label="City" name="city" value={data.city} onChange={(e) => setData('city', e.target.value)} error={errors.city} />
      <TextInput label="Province/State" name="region" value={data.region} onChange={(e) => setData('region', e.target.value)} error={errors.region} />
      <SelectInput label="Country" name="country" value={data.country} onChange={(e) => setData('country', e.target.value)} error={errors.country}>
        <option value=""></option>
        <option value="US">United States</option>
        <option value="CA">Canada</option>
      </SelectInput>
      <TextInput label="Postal code" name="postalCode" value={data.postalCode} onChange={(e) => setData('postalCode', e.target.value)} error={errors.postalCode} />
    </>
  )
}
