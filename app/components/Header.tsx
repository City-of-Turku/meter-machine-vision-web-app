'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

export default function Header() {
  const pathname = usePathname()

  return (
    <header className="w-full px-4 py-4 shadow-md bg-white">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between">
        {/* Logo + Title */}
        <div className="flex items-center space-x-3">
          <Image src="/logo_black.png" alt="Logo" width={120} height={40} />
          <span className="text-gray-600 text-base hidden sm:inline">Meter Reader</span>
        </div>

        {/* Navigation */}
        <nav className="flex space-x-6 mt-3 sm:mt-0">
          <Link
            href="/"
            className={clsx(
              'text-sm sm:text-base hover:text-blue-600 transition',
              pathname === '/' && 'border-b-2 border-blue-600 pb-1 font-semibold'
            )}
          >
            OCR
          </Link>
          <Link
            href="/ai"
            className={clsx(
              'text-sm sm:text-base hover:text-blue-600 transition',
              pathname === '/ai' && 'border-b-2 border-blue-600 pb-1 font-semibold'
            )}
          >
            AI
          </Link>
        </nav>
      </div>
    </header>
  )
}
