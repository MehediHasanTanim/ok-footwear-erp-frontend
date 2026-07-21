import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type AxiosError } from 'axios'
import { X, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

interface Role {
  id: string
  name: string
}

interface User {
  id: string
  firstName: string
  lastName: string | null
  email: string
  roles?: Role[]
}

interface UserDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  user: User | null
  roles: Role[]
}

const userSchema = z.object({
  firstName: z.string().min(1, 'Name is required'),
  lastName: z.string().optional(),
  email: z.string().email('Enter a valid email'),
  password: z.string().optional(),
  roleIds: z.array(z.string()).optional(),
})

type UserFormData = z.infer<typeof userSchema>

export function UserDialog({ open, onClose, onSuccess, user, roles }: UserDialogProps) {
  const queryClient = useQueryClient()
  const isEdit = !!user

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    reset,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '', roleIds: [] },
  })

  const selectedRoleIds = watch('roleIds') ?? []

  // ── Fetch full user details when editing (list response omits roles) ────
  const { data: userDetail } = useQuery({
    queryKey: ['user', user?.id],
    queryFn: async () => {
      const { data } = await api.get<{ data: User }>(`/users/${user!.id}`)
      return data.data
    },
    enabled: open && isEdit,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!open) return
    // Prefer fetched detail (has roles), fall back to list user
    const u = userDetail ?? user
    reset({
      firstName: u?.firstName ?? '',
      lastName: u?.lastName ?? '',
      email: u?.email ?? '',
      password: '',
      roleIds: u?.roles?.map((r) => r.id) ?? [],
    })
  }, [open, user, userDetail, reset])

  const toggleRole = (roleId: string) => {
    setValue(
      'roleIds',
      selectedRoleIds.includes(roleId)
        ? selectedRoleIds.filter((id) => id !== roleId)
        : [...selectedRoleIds, roleId],
      { shouldValidate: false }
    )
  }

  const removeRole = (roleId: string) => {
    setValue(
      'roleIds',
      selectedRoleIds.filter((id) => id !== roleId),
      { shouldValidate: false }
    )
  }

  const mutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const payload = {
        firstName: data.firstName,
        lastName: data.lastName || undefined,
        email: data.email,
        ...(isEdit ? {} : { password: data.password }),
        roleIds: data.roleIds,
      }
      if (isEdit) {
        await api.patch(`/users/${user!.id}`, payload)
      } else {
        await api.post('/users', payload)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      onSuccess()
      onClose()
    },
    onError: (err: AxiosError<{ errors?: Array<{ field: string; message: string }> }>) => {
      const serverErrors = err.response?.data?.errors
      if (serverErrors && Array.isArray(serverErrors)) {
        for (const { field, message } of serverErrors) {
          // Map backend field names to form field names
          const formField = field as 'firstName' | 'lastName' | 'email' | 'password' | 'roleIds'
          setError(formField, { message })
        }
      }
    },
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit User' : 'Create User'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update user details.' : 'Add a new user to the system.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((d) => mutation.mutate(d))}
          className="flex flex-col gap-4"
          data-testid="user-form"
        >
          <div>
            <label htmlFor="firstName" className="mb-1 block text-sm font-medium">
              First Name
            </label>
            <Input
              id="firstName"
              data-testid="user-fullname"
              {...register('firstName')}
              className={cn(errors.firstName && 'border-destructive')}
            />
            {errors.firstName && (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {errors.firstName.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="lastName" className="mb-1 block text-sm font-medium">
              Last Name
            </label>
            <Input id="lastName" data-testid="user-lastname" {...register('lastName')} />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              data-testid="user-email"
              {...register('email')}
              className={cn(errors.email && 'border-destructive')}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          {!isEdit && (
            <div data-testid="user-password-field">
              <label htmlFor="password" className="mb-1 block text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                data-testid="user-password"
                {...register('password')}
                className={cn(errors.password && 'border-destructive')}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Roles</label>
            <div
              className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2"
              data-testid="roles-list"
            >
              {roles.length === 0 && (
                <p className="text-sm text-muted-foreground">No roles available</p>
              )}
              {roles.map((role) => (
                <label
                  key={role.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                    className="h-4 w-4"
                    data-testid={`role-checkbox-${role.id}`}
                  />
                  {role.name}
                </label>
              ))}
            </div>
            {selectedRoleIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1" data-testid="role-chips">
                {selectedRoleIds.map((id) => {
                  const role = roles.find((r) => r.id === id)
                  if (!role) return null
                  return (
                    <Badge key={id} variant="secondary" className="gap-1">
                      {role.name}
                      <button
                        type="button"
                        onClick={() => removeRole(id)}
                        className="ml-1 rounded-full hover:bg-muted"
                        aria-label={`Remove ${role.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="user-submit">
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
