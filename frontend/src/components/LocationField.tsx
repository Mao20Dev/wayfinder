import { useEffect, useState } from 'react'
import { Autocomplete, CircularProgress, TextField } from '@mui/material'
import { request } from '../api'
import type { Location } from '../types'
import type { Language } from '../i18n'

export default function LocationField({
  label,
  value,
  onChange,
  disabled,
  lang = 'es',
}: {
  label: string
  value: Location | null
  onChange: (v: Location | null) => void
  disabled: boolean
  lang?: Language
}) {
  const [text, setText] = useState(value?.name ?? '')
  const [options, setOptions] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (value) setText(value.name)
  }, [value])
  useEffect(() => {
    if (disabled || text.length < 2 || text === value?.name) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setLoading(true)
      setError('')
      request<{ results: Location[] }>(`/api/locations/?q=${encodeURIComponent(text)}`, {
        signal: controller.signal,
      })
        .then((data) => setOptions(data.results))
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message)
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 350)
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [text, value?.name, disabled])
  return (
    <Autocomplete<Location>
      options={options}
      value={value}
      inputValue={text}
      disabled={disabled}
      loading={loading}
      filterOptions={(x) => x}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(a, b) =>
        a.name === b.name && a.latitude === b.latitude && a.longitude === b.longitude
      }
      onChange={(_, next) => {
        onChange(next)
        setText(next?.name ?? '')
      }}
      onInputChange={(_, next, reason) => {
        if (reason === 'input') {
          setText(next)
          if (value) onChange(null)
        }
        if (reason === 'clear') {
          setText('')
          onChange(null)
        }
      }}
      noOptionsText={
        text.length < 2
          ? lang === 'es'
            ? 'Escribe una ciudad'
            : 'Type a city to search'
          : error ||
            (loading
              ? lang === 'es'
                ? 'Buscando…'
                : 'Searching…'
              : lang === 'es'
                ? 'No encontramos esa ciudad'
                : 'No matching cities')
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          size="small"
          placeholder={lang === 'es' ? 'Busca una ciudad' : 'Search a city'}
          helperText={error || undefined}
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading && <CircularProgress size={16} />}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  )
}
