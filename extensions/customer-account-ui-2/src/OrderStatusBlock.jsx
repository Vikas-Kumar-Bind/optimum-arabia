import { useNavigation } from "@shopify/ui-extensions/customer-account/preact";
import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState({});

  useEffect(() => {
    loadTicket();
  }, []);

  function getTicketIdFromNavigation() {
    try {
      const state = navigation.currentEntry?.getState?.();
      if (!state) return null;

      if (typeof state === "string") {
        return state;
      }

      if (typeof state === "object") {
        return state.ticketId || state.ticket || state.id || null;
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  async function loadTicket() {
    const ticketId = getTicketIdFromNavigation();
    console.log("ticketId", ticketId);

    if (!ticketId) {
      setError("No ticket ID was provided.");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(
        `https://hul-services.enscommerce.in/optimum-nutrition-arabia/freshdesk/get-ticket/${encodeURIComponent(ticketId.split("ticket=")[1])}`,
      );
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.message);
      }
      setTicket(json.data);
      await loadOrderDetails(json.data);
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  async function loadOrderDetails(ticketData) {
    const rows =
      ticketData.tableRows?.length > 0
        ? ticketData.tableRows
        : extractOrderRowsFromDescription(ticketData.description_text);
    const result = {};
    await Promise.all(
      rows.map(async (row) => {
        try {
          const order = await fetchOrderByName(row.orderNo);
          result[row.orderNo] = order;
        } catch (e) {
          result[row.orderNo] = null;
        }
      }),
    );
    setOrders(result);
  }
  const ORDER_TABLE_COLUMNS = "100px 1.5fr 100px 160px 1.2fr 110px 110px 1.5fr";
  if (loading) {
    return (
      <s-page heading="All tickets">
        <s-spinner />
      </s-page>
    );
  }
  if (error) {
    return (
      <s-page heading="All tickets">
        <s-banner tone="critical">
          <s-text>{error}</s-text>
        </s-banner>
      </s-page>
    );
  }
  const requester = getRequester(ticket);
  const tableRows = ticket.tableRows?.length
    ? ticket.tableRows
    : extractOrderRowsFromDescription(ticket.description_text);

  return (
    <s-page heading="All tickets">
      <s-stack gap="large">
        <s-box border="base" borderRadius="large" overflow="hidden">
          <s-box
            padding="large"
            border="base"
            borderStyle="none none solid none"
          >
            <s-heading>Ticket Details (Ticket #{ticket.id})</s-heading>
          </s-box>
          <s-stack direction="inline">
            <s-box
              inlineSize="50%"
              padding="large"
              border="base"
              borderStyle="none none solid none"
            >
              <s-stack gap="small">
                <s-text>
                  <s-text type="mark">Topic:</s-text> {ticket.subject}
                </s-text>
                <s-text>
                  <s-text type="mark">Status:</s-text>{" "}
                  {getStatus(ticket.status)}
                </s-text>
                <s-text>
                  <s-text type="mark">Create Date:</s-text>{" "}
                  {formatDate(ticket.created_at)}
                </s-text>
              </s-stack>
            </s-box>
            <s-box
              inlineSize="50%"
              padding="large"
              border="base"
              borderStyle="none none solid solid"
            >
              <s-stack gap="small">
                <s-text>
                  <s-text type="mark">Name:</s-text> {requester.name}
                </s-text>
                <s-text>
                  <s-text type="mark">Email:</s-text> {requester.email}
                </s-text>
                <s-text>
                  <s-text type="mark">Phone:</s-text> {requester.phone}
                </s-text>
              </s-stack>
            </s-box>
          </s-stack>
          <s-stack direction="inline">
            <s-box
              inlineSize="50%"
              padding="large"
              border="base"
              borderStyle="none solid none none"
            >
              <s-heading>Download Attachment</s-heading>
            </s-box>
            <s-box inlineSize="50%" padding="large">
              {ticket.attachments?.length ? (
                <s-stack gap="small">
                  {ticket.attachments.map((attachment) => (
                    <s-link href={attachment.attachment_url} target="_blank">
                      Download
                    </s-link>
                  ))}
                </s-stack>
              ) : (
                <s-text>No Attachments</s-text>
              )}
            </s-box>
          </s-stack>
        </s-box>
        <s-heading>{ticket.subject}</s-heading>
        {tableRows.length > 0 && (
          <s-box border="base" borderRadius="large">
            <s-grid
              gridTemplateColumns={ORDER_TABLE_COLUMNS}
              gap="small-200"
              padding="large"
            >
              <s-text type="mark">Order ID</s-text>
              <s-text type="mark">Product</s-text>
              <s-text type="mark">Total</s-text>
              <s-text type="mark">Date</s-text>
              <s-text type="mark">Customer</s-text>
              <s-text type="mark">Financial</s-text>
              <s-text type="mark">Fulfillment</s-text>
              <s-text type="mark">Items</s-text>
            </s-grid>

            {tableRows.map((row) => {
              const order = orders[row.orderNo];
              return (
                <s-grid
                  key={row.orderNo}
                  gridTemplateColumns={ORDER_TABLE_COLUMNS}
                  gap="small-200"
                  alignItems="center"
                  padding="large"
                  border="base"
                  borderStyle="solid none none none"
                >
                  <s-text>{row.orderNo}</s-text>
                  <s-text>{order?.lineItems?.nodes?.[0]?.title || "-"}</s-text>
                  <s-text>
                    {order?.totalPrice
                      ? `${order.totalPrice.amount} ${order.totalPrice.currencyCode}`
                      : "-"}
                  </s-text>
                  <s-text>{order ? formatDate(order.processedAt) : "-"}</s-text>
                  <s-text>{order?.customer?.displayName || "-"}</s-text>
                  <s-text>{order?.financialStatus || "-"}</s-text>
                  <s-text>{order?.fulfillmentStatus || "-"}</s-text>
                  <s-box>
                    {order?.lineItems?.nodes?.length ? (
                      <s-stack gap="extra-tight">
                        {order.lineItems.nodes.map((item) => (
                          <s-text key={item.id}>
                            {item.quantity} × {item.title}
                          </s-text>
                        ))}
                      </s-stack>
                    ) : (
                      <s-text>-</s-text>
                    )}
                  </s-box>
                </s-grid>
              );
            })}
          </s-box>
        )}
      </s-stack>
    </s-page>
  );
}

const ORDER_FIELDS = `
  id
  name
  processedAt
  financialStatus
  fulfillmentStatus
  customer {
    displayName
    email
  }
  totalPrice {
    amount
    currencyCode
  }
  lineItems(first: 20) {
    nodes {
      id
      title
      quantity
      image {
        url
      }
      totalPrice {
        amount
        currencyCode
      }
    }
  }
`;
async function fetchOrderByName(orderName) {
  const searched = await searchCustomerOrderByName(orderName);
  if (searched) return searched;
  const fallback = await findCustomerOrderByNameFromRecent(orderName);
  if (fallback) return fallback;
  throw new Error(`Order ${orderName} not found on this account`);
}

async function searchCustomerOrderByName(orderName) {
  const safeOrderName = orderName.replace(/'/g, "\\'");
  const json = await customerAccountGraphQL(
    `#graphql
      query GetCustomerOrderByName($searchQuery: String!) {
        customer {
          orders(
            first: 1
            query: $searchQuery
            sortKey: PROCESSED_AT
            reverse: true
          ) {
            nodes {
              ${ORDER_FIELDS}
            }
          }
        }
      }
    `,
    { searchQuery: `name:'${safeOrderName}'` },
  );
  return json.data?.customer?.orders?.nodes?.[0] ?? null;
}
async function findCustomerOrderByNameFromRecent(orderName) {
  const json = await customerAccountGraphQL(
    `#graphql
      query GetRecentCustomerOrders {
        customer {
          orders(first: 50, sortKey: PROCESSED_AT, reverse: true) {
            nodes {
              ${ORDER_FIELDS}
            }
          }
        }
      }
    `,
  );
  const orders = json.data?.customer?.orders?.nodes ?? [];
  const target = normalizeOrderName(orderName);
  return (
    orders.find((order) => normalizeOrderName(order.name) === target) ?? null
  );
}
function normalizeOrderName(name) {
  return (name ?? "").trim().replace(/^#/, "").toLowerCase();
}
async function customerAccountGraphQL(query, variables) {
  const response = await fetch(
    `shopify://customer-account/api/2026-07/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  const json = await response.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }
  return json;
}

function extractOrderRowsFromDescription(descriptionText) {
  if (!descriptionText) return [];
  const matches = descriptionText.matchAll(/Order\s*ID\s*-\s*(\S+)/gi);
  const seen = new Set();
  const rows = [];
  for (const match of matches) {
    const orderNo = match[1].replace(/[.,]$/, "");
    if (seen.has(orderNo)) continue;
    seen.add(orderNo);
    rows.push({
      orderNo,
      productDesc: "-",
      billValue: "-",
      queryDate: "-",
    });
  }
  return rows;
}

function parseEmailEntry(entry) {
  if (!entry) return { name: null, email: null };
  const match = entry.match(/"?([^"<]*)"?\s*<([^>]+)>/);
  if (match) {
    return {
      name: match[1].trim() || null,
      email: match[2].trim(),
    };
  }
  return { name: null, email: entry.trim() };
}

function getRequester(ticket) {
  const source = ticket.to_emails?.[0] || ticket.cc_emails?.[0];
  const { name, email } = parseEmailEntry(source);
  return {
    name: name || "-",
    email: email || "-",
    phone: ticket.phone || "-",
  };
}

function getStatus(status) {
  const statuses = {
    2: "Open",
    3: "Pending",
    4: "Resolved",
    5: "Closed",
  };
  return statuses[status] || "New";
}

function formatDate(date) {
  if (!date) return "-";
  return new Date(date).toLocaleString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
