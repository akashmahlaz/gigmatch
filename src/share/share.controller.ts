/// 🔗 GIGMATCH SHARE CONTROLLER
///
/// Serves HTML pages with Open Graph meta tags for link previews.
/// Also serves .well-known files for App Links / Universal Links verification.
///
/// These routes are EXCLUDED from the /api/v1 global prefix because
/// they need to be at the root for social media crawlers and app verification.

import { Controller, Get, Param, Res, Header, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ShareService } from './share.service';

@Controller()
export class ShareController {
  private readonly logger = new Logger(ShareController.name);

  constructor(private readonly shareService: ShareService) {}

  // ═══════════════════════════════════════════════════════════════════
  // 📤 SHARE PAGES (OG Meta Tags for Link Previews)
  // ═══════════════════════════════════════════════════════════════════

  @Get('share/artist/:id')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  async shareArtist(@Param('id') id: string, @Res() res: Response) {
    this.logger.log(` [Share] Artist share page requested: ${id}`);
    const html = await this.shareService.getArtistSharePage(id);
    res.send(html);
  }

  @Get('share/venue/:id')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  async shareVenue(@Param('id') id: string, @Res() res: Response) {
    this.logger.log(` [Share] Venue share page requested: ${id}`);
    const html = await this.shareService.getVenueSharePage(id);
    res.send(html);
  }

  @Get('share/post/:id')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  async sharePost(@Param('id') id: string, @Res() res: Response) {
    this.logger.log(` [Share] Post share page requested: ${id}`);
    const html = await this.shareService.getPostSharePage(id);
    res.send(html);
  }

  @Get('share/gig/:id')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=1800')
  async shareGig(@Param('id') id: string, @Res() res: Response) {
    this.logger.log(` [Share] Gig share page requested: ${id}`);
    const html = await this.shareService.getGigSharePage(id);
    res.send(html);
  }

  @Get('share/story/:id')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  async shareStory(@Param('id') id: string, @Res() res: Response) {
    this.logger.log(`📤 [Share] Story share page requested: ${id}`);
    const html = await this.shareService.getStorySharePage(id);
    res.send(html);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🔐 WELL-KNOWN FILES (App Links / Universal Links Verification)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Android App Links verification
   * https://gigmatch.app/.well-known/assetlinks.json
   *
   * NOTE: Update the sha256_cert_fingerprints with your actual signing key.
   * Get it via: keytool -list -v -keystore your-key.jks
   * Or from Play Console > App signing > SHA-256 certificate fingerprint
   */
  @Get('.well-known/assetlinks.json')
  @Header('Content-Type', 'application/json')
  @Header('Cache-Control', 'public, max-age=86400')
  getAssetLinks() {
    this.logger.log('🔐 [Share] Android assetlinks.json requested');
    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.gigmatch.music',
          sha256_cert_fingerprints: [
            // TODO: Replace with actual signing key SHA-256 fingerprint
            // Debug key (get via: keytool -list -v -keystore ~/.android/debug.keystore -storepass android)
            'TO:DO:REPLACE:WITH:ACTUAL:SHA256:FINGERPRINT',
          ],
        },
      },
    ];
  }

  /**
   * iOS Universal Links verification
   * https://gigmatch.app/.well-known/apple-app-site-association
   *
   * NOTE: Update the appID with your actual Apple Team ID + Bundle ID
   * Format: TEAM_ID.com.gigmatch.app
   */
  @Get('.well-known/apple-app-site-association')
  @Header('Content-Type', 'application/json')
  @Header('Cache-Control', 'public, max-age=86400')
  getAppleAppSiteAssociation() {
    this.logger.log('🔐 [Share] iOS apple-app-site-association requested');
    return {
      applinks: {
        apps: [],
        details: [
          {
            // TODO: Replace TEAM_ID with your actual Apple Developer Team ID
            appID: 'TEAM_ID.com.gigmatch.app',
            paths: [
              '/artist/*',
              '/venue/*',
              '/post/*',
              '/gig/*',
              '/story/*',
              '/profile/*',
              '/chat/*',
              '/share/*',
            ],
          },
        ],
      },
      webcredentials: {
        apps: ['TEAM_ID.com.gigmatch.app'],
      },
    };
  }
}
