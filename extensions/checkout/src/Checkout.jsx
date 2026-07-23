import {
  useBuyerJourneyIntercept,
  useShippingAddress,
  useTotalAmount,
} from "@shopify/ui-extensions/checkout/preact";
import "@shopify/ui-extensions/preact";
import { render } from "preact";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const address = useShippingAddress();
  const country = address.countryCode ?? "";
  const totalAmount = useTotalAmount();
  const amount = Number(totalAmount.amount);

  const thresold = {
    SA: 966.89,
    KW: 1162.89,
    BH: 2908.23,
    QA: 995.38,
    OM: 935.58,
  };

  const thresoldMax = country !== "" ? (thresold[country] ?? 0) : 0;
  console.log("amount", amount, "country", country, "thresoldMax", thresoldMax);

  useBuyerJourneyIntercept(({ canBlockProgress }) => {
    return canBlockProgress && thresoldMax !== 0 && amount > thresoldMax
      ? {
          behavior: "block",
          reason: "Not allowed",
          errors: [
            {
              message: `Order total cannot exceed ${thresoldMax}.`,
            },
          ],
        }
      : {
          behavior: "allow",
        };
  });

  return null;
}
