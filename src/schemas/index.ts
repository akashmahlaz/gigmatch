// Export all schemas
export * from './user.schema';
export type { Artist, ArtistDocument, AvailabilitySlot, AvailabilityStatus } from './artist.schema';
export { ArtistSchema } from './artist.schema';
export type { Venue, VenueDocument, VenueType, ContactPerson } from './venue.schema';
export { VenueSchema } from './venue.schema';
export type { Gig, GigDocument } from '../gigs/schemas/gig.schema';
export { GigSchema } from '../gigs/schemas/gig.schema';
export * from './swipe.schema';
export * from './match.schema';
export * from './message.schema';
export * from './booking.schema';
export * from './review.schema';
export * from './subscription.schema';
export * from './notification.schema';
