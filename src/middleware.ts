import { NextRequest, NextResponse } from 'next/server';

/**
 * Primeira barreira de acesso: sem o cookie de sessao, o usuario nem chega as
 * paginas internas. A validacao real da assinatura do token e o controle de
 * permissoes continuam no servidor (requireContext / requirePermission) - este
 * middleware apenas evita renderizar telas e consultar o banco a toa.
 */
const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get('tunico_session')?.value);

  if (PUBLIC_PATHS.includes(pathname)) {
    if (hasSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    // Guarda o destino para voltar depois do login.
    if (pathname !== '/') loginUrl.searchParams.set('proximo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Ignora assets, imagens e as rotas internas do Next.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand|icon.svg|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
};
