import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import {
  createCheckoutSession,
  createDonationCheckout,
  createJuriCreditCheckout,
} from "@/utils/payments.functions";

type Props = {
  returnPath?: string;
} & ({ priceId: string } | { donationCents: number } | { creditPackId: string });

export function StripeEmbeddedCheckout(props: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const secret =
      "donationCents" in props
        ? await createDonationCheckout({
            data: { amountInCents: props.donationCents, returnPath: props.returnPath },
          })
        : "creditPackId" in props
          ? await createJuriCreditCheckout({
              data: { packId: props.creditPackId, returnPath: props.returnPath },
            })
          : await createCheckoutSession({
              data: { priceId: props.priceId, returnPath: props.returnPath },
            });
    if (!secret) throw new Error("No client secret returned");
    return secret;
  };

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
