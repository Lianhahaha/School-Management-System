/**
 * Who is responsible for the personal data in this app, for the Privacy Notice (features/privacy) and the
 * sign-up consent. Under the Data Privacy Act of 2012 (RA 10173) the school is the personal information
 * controller and must give its name and the contact details of its Data Protection Officer (DPO). `address`,
 * `dpoName` and `dpoPhone` are shown only when filled in.
 *
 * The date of the notice's wording is PRIVACY_NOTICE_VERSION in constants/shared: the API refuses a sign-up
 * that agreed to another version, and records the one agreed to.
 */
export const SCHOOL = Object.freeze({
  name: 'Skole',
  address: '',
  dpoName: '',
  dpoEmail: 'skole@gmail.com',
  dpoPhone: '',
});

/** Where a complaint to the National Privacy Commission is filed. */
export const NPC_COMPLAINTS_URL = 'https://privacy.gov.ph';
