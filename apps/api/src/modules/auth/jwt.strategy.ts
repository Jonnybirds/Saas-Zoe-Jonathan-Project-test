import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET', 'dev-secret'),
    });
  }

  async validate(payload: { sub: string; tenantId: string; email: string }) {
    const claims = await this.authService.resolveClaims(
      payload.tenantId,
      payload.sub,
      payload.email,
    );

    if (!claims) {
      throw new UnauthorizedException('Invalid access token');
    }

    return claims;
  }
}
