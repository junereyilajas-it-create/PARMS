import { useState, useCallback } from 'react'

export type ValidationRule<T> = (value: T, formValues: Record<string, T>) => string | null // Returns error message or null if valid

export function validateRequired(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return 'This field is required.'
  if (typeof value === 'string' && value.trim() === '') return 'This field is required.'
  return null
}

export function validateEmail(value: string): string | null {
  if (!value) return 'This field is required.' // Email is implicitly required if using this rule
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(value)) return 'Please enter a valid email address.'
  return null
}

export function validatePassword(value: string): string | null {
  if (!value || value.length < 6) return 'Password must be at least 6 characters.'
  return null
}

export function validateNumber(value: string | number): string | null {
  if (value === null || value === undefined || value === '') return null // Not checking required here
  if (isNaN(Number(value))) return 'Must be a valid number.'
  if (Number(value) < 0) return 'Cannot be negative.'
  return null
}

export type FieldConfig<T> = {
  initialValue: T
  rules?: ValidationRule<T>[]
}

export function useFormValidation<T extends Record<string, any>>(config: Record<keyof T, FieldConfig<any>>) {
  const initialValues = Object.fromEntries(Object.entries(config).map(([key, field]) => [key, (field as any).initialValue])) as T
  const [values, setValues] = useState<T>(initialValues)
  const [touched, setTouched] = useState<Record<keyof T, boolean>>({} as Record<keyof T, boolean>)
  
  // Track if a generic attempt to submit happened, which marks all fields touched
  const [submitted, setSubmitted] = useState(false)

  const setValue = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }))
    setTouched(prev => ({ ...prev, [field]: true }))
  }, [])

  const setFieldTouched = useCallback((field: keyof T) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }, [])

  const markAllTouched = useCallback(() => {
    const allTouched = Object.keys(config).reduce((acc, key) => {
      acc[key as keyof T] = true
      return acc
    }, {} as Record<keyof T, boolean>)
    setTouched(allTouched)
    setSubmitted(true)
  }, [config])

  const getFieldError = useCallback((field: keyof T): string | null => {
    const rules = config[field].rules || []
    for (const rule of rules) {
      const error = rule(values[field], values)
      if (error) return error
    }
    return null
  }, [config, values])

  const isValid = useCallback(() => {
    for (const key of Object.keys(config)) {
      if (getFieldError(key as keyof T)) return false
    }
    return true
  }, [config, getFieldError])

  const getFieldClass = useCallback((field: keyof T, defaultClass = '') => {
    const isTouched = touched[field] || submitted
    if (!isTouched) return defaultClass
    
    const error = getFieldError(field)
    return `${defaultClass} ${error ? 'input-invalid' : 'input-valid'}`.trim()
  }, [touched, submitted, getFieldError])

  return {
    values,
    setValues,
    setValue,
    touched,
    setFieldTouched,
    markAllTouched,
    getFieldError,
    isValid,
    getFieldClass,
  }
}
