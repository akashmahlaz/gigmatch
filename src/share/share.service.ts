/// 🔗 GIGMATCH SHARE SERVICE
///
/// Fetches entity data and generates Open Graph HTML pages
/// for link previews when sharing content externally

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Artist } from '../artists/schemas/artist.schema';
import { Venue } from '../venues/schemas/venue.schema';
import { Post } from '../schemas/post.schema';
import { Gig } from '../schemas/gig.schema';
import { Story } from '../schemas/story.schema';

interface OgData {
  title: string;
  description: string;
  image: string;
  url: string;
  type: string;
}

@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);

  // Share page canonical URL — uses env var, falls back to local dev IP
  private readonly APP_URL = process.env.SHARE_BASE_URL || 'http://10.183.58.168:3000';
  private readonly FALLBACK_IMAGE =
    'https://res.cloudinary.com/gigmatch/image/upload/v1/og/gigmatch-default.png';

  constructor(
    @InjectModel(Artist.name) private artistModel: Model<Artist>,
    @InjectModel(Venue.name) private venueModel: Model<Venue>,
    @InjectModel(Post.name) private postModel: Model<Post>,
    @InjectModel(Gig.name) private gigModel: Model<Gig>,
    @InjectModel(Story.name) private storyModel: Model<Story>,
  ) {}

  // ═══════════════════════════════════════════════════════════════════
  // 🎤 ARTIST SHARE PAGE
  // ═══════════════════════════════════════════════════════════════════

  async getArtistSharePage(artistId: string): Promise<string> {
    this.logger.log(`📤 [Share] Generating artist share page: ${artistId}`);

    try {
      // Use any to access raw document fields from lean()
      const artist: any = await this.artistModel.findById(artistId).lean();

      if (!artist) {
        this.logger.warn(`⚠️ [Share] Artist not found: ${artistId}`);
        return this.generateOgHtml({
          title: 'Artist on GigMatch',
          description: 'Discover amazing artists on GigMatch - Where Artists Meet Stages 🎵',
          image: this.FALLBACK_IMAGE,
          url: `${this.APP_URL}/artist/${artistId}`,
          type: 'profile',
        });
      }

      const name = artist.stageName || artist.displayName || 'Artist';
      const genres = artist.genres?.join(', ') || '';
      const location = artist.location?.city || '';
      const photo = artist.profilePhotoUrl || artist.photos?.[0]?.url || '';
      const description = this.buildDescription([
        genres ? `🎸 ${genres}` : '',
        location ? `📍 ${location}` : '',
        artist.bio ? artist.bio.substring(0, 150) : '',
        'Discover on GigMatch - Where Artists Meet Stages 🎵',
      ]);

      return this.generateOgHtml({
        title: `${name} on GigMatch`,
        description,
        image: photo || this.FALLBACK_IMAGE,
        url: `${this.APP_URL}/artist/${artistId}`,
        type: 'profile',
      });
    } catch (error) {
      this.logger.error(`❌ [Share] Error generating artist page: ${error}`);
      return this.generateFallbackPage('artist', artistId);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🏛️ VENUE SHARE PAGE
  // ═══════════════════════════════════════════════════════════════════

  async getVenueSharePage(venueId: string): Promise<string> {
    this.logger.log(`📤 [Share] Generating venue share page: ${venueId}`);

    try {
      // Use any to access raw document fields from lean()
      const venue: any = await this.venueModel.findById(venueId).lean();

      if (!venue) {
        this.logger.warn(`⚠️ [Share] Venue not found: ${venueId}`);
        return this.generateOgHtml({
          title: 'Venue on GigMatch',
          description: 'Discover amazing venues on GigMatch - Where Artists Meet Stages 🎵',
          image: this.FALLBACK_IMAGE,
          url: `${this.APP_URL}/venue/${venueId}`,
          type: 'profile',
        });
      }

      const name = venue.venueName || 'Venue';
      const venueType = venue.venueType || '';
      const location = venue.location?.city || '';
      const photo = venue.photos?.[0]?.url || '';
      const description = this.buildDescription([
        venueType ? `🏛️ ${venueType}` : '',
        location ? `📍 ${location}` : '',
        venue.description ? venue.description.substring(0, 150) : '',
        'Discover on GigMatch - Where Artists Meet Stages 🎵',
      ]);

      return this.generateOgHtml({
        title: `${name} on GigMatch`,
        description,
        image: photo || this.FALLBACK_IMAGE,
        url: `${this.APP_URL}/venue/${venueId}`,
        type: 'profile',
      });
    } catch (error) {
      this.logger.error(`❌ [Share] Error generating venue page: ${error}`);
      return this.generateFallbackPage('venue', venueId);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📝 POST SHARE PAGE
  // ═══════════════════════════════════════════════════════════════════

  async getPostSharePage(postId: string): Promise<string> {
    this.logger.log(`📤 [Share] Generating post share page: ${postId}`);

    try {
      const post: any = await this.postModel.findById(postId).lean();

      if (!post) {
        this.logger.warn(`⚠️ [Share] Post not found: ${postId}`);
        return this.generateOgHtml({
          title: 'Post on GigMatch',
          description: 'Check out this post on GigMatch - Where Artists Meet Stages 🎵',
          image: this.FALLBACK_IMAGE,
          url: `${this.APP_URL}/post/${postId}`,
          type: 'article',
        });
      }

      const caption = post.caption || '';
      const title = caption.length > 60 ? `${caption.substring(0, 57)}...` : caption || 'Post on GigMatch';
      const firstMedia = post.media?.[0];
      const image =
        firstMedia?.type === 'image'
          ? firstMedia.url
          : firstMedia?.thumbnailUrl || this.FALLBACK_IMAGE;

      return this.generateOgHtml({
        title,
        description: caption.length > 150
          ? `${caption.substring(0, 147)}...`
          : caption || 'Check out this post on GigMatch 🎵',
        image: image || this.FALLBACK_IMAGE,
        url: `${this.APP_URL}/post/${postId}`,
        type: 'article',
      });
    } catch (error) {
      this.logger.error(`❌ [Share] Error generating post page: ${error}`);
      return this.generateFallbackPage('post', postId);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎵 GIG SHARE PAGE
  // ═══════════════════════════════════════════════════════════════════

  async getGigSharePage(gigId: string): Promise<string> {
    this.logger.log(`📤 [Share] Generating gig share page: ${gigId}`);

    try {
      const gig: any = await this.gigModel.findById(gigId).lean();

      if (!gig) {
        this.logger.warn(`⚠️ [Share] Gig not found: ${gigId}`);
        return this.generateOgHtml({
          title: 'Gig on GigMatch',
          description: 'Check out this gig on GigMatch - Where Artists Meet Stages 🎵',
          image: this.FALLBACK_IMAGE,
          url: `${this.APP_URL}/gig/${gigId}`,
          type: 'event',
        });
      }

      const title = gig.title || 'Gig on GigMatch';
      const city = gig.location?.city || '';
      const date = gig.date ? new Date(gig.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }) : '';
      const genres = gig.requiredGenres?.join(', ') || '';
      const budget = gig.budget ? `$${gig.budget}` : '';

      const description = this.buildDescription([
        city ? `📍 ${city}` : '',
        date ? `📅 ${date}` : '',
        genres ? `🎸 ${genres}` : '',
        budget ? `💰 ${budget}` : '',
        gig.description ? gig.description.substring(0, 100) : '',
      ]);

      return this.generateOgHtml({
        title: `${title} - GigMatch`,
        description,
        image: this.FALLBACK_IMAGE,
        url: `${this.APP_URL}/gig/${gigId}`,
        type: 'event',
      });
    } catch (error) {
      this.logger.error(`❌ [Share] Error generating gig page: ${error}`);
      return this.generateFallbackPage('gig', gigId);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 📖 STORY SHARE PAGE
  // ═══════════════════════════════════════════════════════════════════

  async getStorySharePage(storyId: string): Promise<string> {
    this.logger.log(`📤 [Share] Generating story share page: ${storyId}`);

    try {
      const story: any = await this.storyModel.findById(storyId).lean();

      if (!story) {
        return this.generateOgHtml({
          title: 'Story on GigMatch',
          description: 'Check out this story on GigMatch 🎵',
          image: this.FALLBACK_IMAGE,
          url: `${this.APP_URL}/story/${storyId}`,
          type: 'article',
        });
      }

      const firstItem = story.items?.[0];
      const image = firstItem?.url || this.FALLBACK_IMAGE;
      const caption = firstItem?.caption || '';

      return this.generateOgHtml({
        title: caption || 'Story on GigMatch',
        description: caption || 'Check out this story on GigMatch - Where Artists Meet Stages 🎵',
        image,
        url: `${this.APP_URL}/story/${storyId}`,
        type: 'article',
      });
    } catch (error) {
      this.logger.error(`❌ [Share] Error generating story page: ${error}`);
      return this.generateFallbackPage('story', storyId);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🔧 HELPERS
  // ═══════════════════════════════════════════════════════════════════

  private buildDescription(parts: string[]): string {
    return parts.filter((p) => p.length > 0).join('\n');
  }

  private generateFallbackPage(type: string, id: string): string {
    return this.generateOgHtml({
      title: 'GigMatch - Where Artists Meet Stages',
      description: 'Discover amazing artists, venues, and gigs on GigMatch 🎵',
      image: this.FALLBACK_IMAGE,
      url: `${this.APP_URL}/${type}/${id}`,
      type: 'website',
    });
  }

  /**
   * Generate a full HTML page with Open Graph meta tags.
   * 
   * When crawled by social media (WhatsApp, Twitter, iMessage, Facebook, etc.)
   * the OG tags produce a rich link preview.
   * 
   * When opened by a real browser, the page attempts to:
   * 1. Open the app via deep link (gigmatch:// scheme)
   * 2. Redirect to the app store if the app isn't installed
   * 3. Show a clean landing page as fallback
   */
  private generateOgHtml(data: OgData): string {
    const escapedTitle = this.escapeHtml(data.title);
    const escapedDesc = this.escapeHtml(data.description);
    const escapedImage = this.escapeHtml(data.image);
    const escapedUrl = this.escapeHtml(data.url);

    // Extract path from URL for deep link
    const urlPath = new URL(data.url).pathname;
    const deepLink = `gigmatch:/${urlPath}`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapedTitle}</title>

  <!-- Open Graph -->
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDesc}">
  <meta property="og:image" content="${escapedImage}">
  <meta property="og:url" content="${escapedUrl}">
  <meta property="og:type" content="${data.type}">
  <meta property="og:site_name" content="GigMatch">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapedTitle}">
  <meta name="twitter:description" content="${escapedDesc}">
  <meta name="twitter:image" content="${escapedImage}">

  <!-- App Smart Banners -->
  <meta name="apple-itunes-app" content="app-id=YOUR_APP_ID, app-argument=${escapedUrl}">
  <meta name="google-play-app" content="app-id=com.gigmatch.music">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a0a1a 50%, #0a0a0a 100%);
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 20px;
    }
    .container { max-width: 400px; }
    .logo { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 24px; margin-bottom: 8px; color: #DC143C; }
    p { font-size: 16px; color: #aaa; margin-bottom: 24px; line-height: 1.5; }
    .btn {
      display: inline-block;
      background: #DC143C;
      color: #fff;
      padding: 14px 32px;
      border-radius: 30px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s;
    }
    .btn:hover { transform: scale(1.05); }
    .store-links { margin-top: 16px; }
    .store-links a { color: #DC143C; text-decoration: none; margin: 0 8px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🎵</div>
    <h1>${escapedTitle}</h1>
    <p>${escapedDesc}</p>
    <a href="${deepLink}" class="btn" id="openApp">Open in GigMatch</a>
    <div class="store-links">
      <a href="https://apps.apple.com/app/gigmatch/id0000000000">App Store</a>
      <span style="color:#333">|</span>
      <a href="https://play.google.com/store/apps/details?id=com.gigmatch.music">Google Play</a>
    </div>
  </div>

  <script>
    // Try to open the app, fallback to store after timeout
    (function() {
      var deepLink = '${deepLink}';
      var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      var isAndroid = /Android/i.test(navigator.userAgent);

      // If user clicks "Open in GigMatch", try deep link first
      document.getElementById('openApp').addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = deepLink;

        // Fallback to store after 1.5s
        setTimeout(function() {
          if (isIOS) {
            window.location.href = 'https://apps.apple.com/app/gigmatch/id0000000000';
          } else if (isAndroid) {
            window.location.href = 'https://play.google.com/store/apps/details?id=com.gigmatch.music';
          }
        }, 1500);
      });

      // Auto-attempt deep link on mobile (bots/crawlers won't execute JS)
      if (isIOS || isAndroid) {
        window.location.href = deepLink;
        setTimeout(function() {
          // If still here, app not installed — show page
        }, 2000);
      }
    })();
  </script>
</body>
</html>`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
