import { useEffect, useState } from 'react';
import { MapPin, ArrowRight, LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { getCurrentPosition, reverseGeocode, type ResolvedLocation } from '../../lib/geolocation';

interface PincodeEntryProps {
  onSubmit: (pincode: string, location?: ResolvedLocation | null) => void;
  initialPincode?: string;
}

export function PincodeEntry({ onSubmit, initialPincode }: PincodeEntryProps) {
  const [pincode, setPincode] = useState(initialPincode || '');
  const [error, setError] = useState('');
  const [locationMessage, setLocationMessage] = useState('');
  const [locationStep, setLocationStep] = useState<'idle' | 'explain' | 'loading'>('idle');

  useEffect(() => setPincode(initialPincode || ''), [initialPincode]);

  const handleSubmit = () => {
    if (!/^\d{6}$/.test(pincode)) {
      setError('Enter a valid 6-digit pincode');
      return;
    }
    setError('');
    onSubmit(pincode);
  };

  const detectLocation = async () => {
    if (locationStep === 'idle') {
      setLocationStep('explain');
      setLocationMessage("We'll use your location just to find nearby cooks. It won't be stored or shared.");
      return;
    }
    setLocationStep('loading');
    setLocationMessage('Finding your area securely...');
    try {
      const position = await getCurrentPosition();
      const location = await reverseGeocode(position.coords.latitude, position.coords.longitude);
      setPincode(location.pincode);
      setLocationMessage(`Located ${location.locality || location.pincode}.`);
      onSubmit(location.pincode, location);
    } catch (reason) {
      const errorCode = reason && typeof reason === 'object' && 'code' in reason ? reason.code : undefined;
      setLocationStep('idle');
      setLocationMessage(errorCode === 1 ? 'No problem — just type your pincode below.' : 'We could not detect your area. Just type your pincode below.');
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-lg flex-col items-center justify-center px-4 animate-fade-in">
      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-spice-50 text-spice">
        <MapPin size={32} strokeWidth={1.5} />
      </div>
      <h1 className="font-display text-3xl font-semibold text-ink text-center text-balance">
        Home-cooked tiffin, from your neighbourhood
      </h1>
      <p className="mt-3 text-center text-ink-muted text-balance">
        Real home kitchens, daily meals on subscription. Start by telling us
        your pincode — we'll show cooks near you.
      </p>

      <div className="mt-8 w-full max-w-sm space-y-3">
        <Input
          name="pincode"
          label="Your pincode"
          placeholder="e.g. 560001"
          inputMode="numeric"
          maxLength={6}
          prefix={<MapPin size={16} />}
          value={pincode}
          onChange={(e) => {
            setPincode(e.target.value.replace(/\D/g, ''));
            if (error) setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          error={error}
        />
        <Button
          size="lg"
          fullWidth
          onClick={handleSubmit}
          disabled={pincode.length !== 6}
        >
          Find cooks near me
          <ArrowRight size={18} />
        </Button>
        <Button variant="outline" size="lg" fullWidth onClick={detectLocation} disabled={locationStep === 'loading'}>
          <LocateFixed size={17} />
          {locationStep === 'loading' ? 'Detecting location...' : locationStep === 'explain' ? 'Allow location access' : 'Use my location'}
        </Button>
        {locationMessage && <p className="text-center text-xs text-ink-muted">{locationMessage}</p>}
        {locationStep === 'loading' && (
          <div className="space-y-2 rounded-md border border-steel/10 bg-paper-50 p-3">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-ink-faint">Location is used only to find nearby cooks and is not stored or shared. · Prototype — no real payment or delivery.</p>
    </div>
  );
}
