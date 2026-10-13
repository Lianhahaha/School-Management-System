import { Mail, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { SCHOOL } from '../../../constants/privacy';
import { formatDate, isoToYmd } from '../../../utils/date';

/**
 * The profile's privacy card: when the account agreed to the notice, and the way to the Data Protection
 * Officer for the rights the notice lists (see, correct, delete, withdraw consent). Withdrawing goes the same
 * way as any other request, as the law asks that it be as easy as agreeing.
 * @param {object} props
 * @param {{ privacyAcceptedAt?: string|null, privacyNoticeVersion?: string|null }} props.me
 */
export function PrivacyCard({ me }) {
  const subject = encodeURIComponent('Data privacy request');

  return (
    <Card title="Privacy" description="How the school uses your information, and how to ask about it.">
      <div className="space-y-4 text-sm text-gray-700">
        <p>
          {me.privacyAcceptedAt
            ? `You agreed to the Privacy Notice of ${formatDate(me.privacyNoticeVersion)} on ${formatDate(isoToYmd(me.privacyAcceptedAt))}.`
            : 'Your account was made by the school office; the Privacy Notice applies to it too.'}
        </p>
        <p>
          You can ask to see your data, get a copy, correct it, delete what the school does not need, or
          withdraw your consent. Write to the Data Protection Officer at {SCHOOL.dpoEmail}; the school answers
          within 30 working days.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button as={Link} to="/privacy" variant="secondary" icon={ShieldCheck}>
            Read the Privacy Notice
          </Button>
          <Button
            as="a"
            href={`mailto:${SCHOOL.dpoEmail}?subject=${subject}`}
            variant="secondary"
            icon={Mail}
          >
            Email the Data Protection Officer
          </Button>
        </div>
      </div>
    </Card>
  );
}
