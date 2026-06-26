import { describe, expect, it } from 'vitest'

import { Button } from '@/components/ui/button'
import { render, screen } from '@/test/test-utils'

describe('Button (shadcn/ui)', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  it('renders destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button', { name: /delete/i })
    expect(button).toBeInTheDocument()
  })

  it('fires onClick handler', async () => {
    let clicked = false
    const { user } = render(<Button onClick={() => (clicked = true)}>Click</Button>)

    const button = screen.getByRole('button', { name: /click/i })
    await user.click(button)

    expect(clicked).toBe(true)
  })

  it('renders disabled state', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button', { name: /disabled/i })
    expect(button).toBeDisabled()
  })

  it('renders as child when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    )
    const link = screen.getByRole('link', { name: /link button/i })
    expect(link).toHaveAttribute('href', '/test')
  })
})
