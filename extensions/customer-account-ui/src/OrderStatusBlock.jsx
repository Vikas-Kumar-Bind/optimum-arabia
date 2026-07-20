import "@shopify/ui-extensions/customer-account";
import { useNavigation } from "@shopify/ui-extensions/customer-account/preact";
import { render } from "preact";
import { useState, useRef } from "preact/hooks";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const navigation = useNavigation();
  const [helpTopic, setHelpTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState("");
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [customer, setCustomer] = useState(null);
  const orderRequiredTopics = [
    "order_related_issue",
    "order_cancellation",
    "returns",
    "coupons_promotions",
    "refunds_status",
    "delivery_related",
    "damaged_container",
    "spillage",
    "broken_seal",
    "presence_of_lumps",
  ];
  async function handleHelpTopicChange(value) {
    setHelpTopic(value);
    const shouldLoadOrders = orderRequiredTopics.includes(value);

    setSelectedOrder("");
    setOrders([]);

    if (!value) return;

    setLoadingOrders(shouldLoadOrders);
    try {
      const response = await fetch(
        "shopify://customer-account/api/2026-04/graphql.json",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `
              query CustomerData {
                customer {
                  firstName
                  lastName
                  emailAddress {
                    emailAddress
                  }
                  phoneNumber {
                    phoneNumber
                  }

                  orders(first: 10) {
                    nodes {
                      id
                      name
                      confirmationNumber
                      processedAt
                      totalPrice {
                        amount
                      }
                      fulfillments(first: 10) {
                        nodes {
                          status
                          createdAt
                        }
                      }
                      lineItems(first: 20) {
                        nodes {
                          id
                          title
                          quantity
                          image {
                            url
                          }
                        }
                      }
                    }
                  }
                }
              }
            `,
          }),
        },
      );
      const json = await response.json();
      if (json.data?.customer) {
        setCustomer({
          firstName: json.data.customer.firstName || "",
          lastName: json.data.customer.lastName || "",
          email: json.data.customer.emailAddress?.emailAddress || "",
          phone: json.data.customer.phoneNumber?.phoneNumber || "",
        });
      }
      if (shouldLoadOrders) {
        setOrders(json.data?.customer?.orders?.nodes ?? []);
      }
    } catch (error) {
      console.error(error);
      await shopify.toast.show("Unable to load customer details.");
    } finally {
      setLoadingOrders(false);
    }
  }
  const idCounter = useRef(0);
  function nextId() {
    idCounter.current += 1;
    return `upload-${idCounter.current}`;
  }
  const [uploadFields, setUploadFields] = useState([
    { id: nextId(), files: [] },
  ]);
  function addUploadField() {
    setUploadFields((prev) => [...prev, { id: nextId(), files: [] }]);
  }
  function removeUploadField(id) {
    setUploadFields((prev) => prev.filter((item) => item.id !== id));
  }
  function updateFiles(id, files) {
    setUploadFields((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              files: Array.from(files),
            }
          : item,
      ),
    );
  }
  const helpTopics = [
    { label: "-- Select a Help Topic --", value: "" },
    { label: "Order Related Issue", value: "order_related_issue" },
    { label: "Order Cancellation", value: "order_cancellation" },
    { label: "General", value: "general" },
    { label: "Returns", value: "returns" },
    { label: "Coupons & Promotions", value: "coupons_promotions" },
    { label: "Refunds Status", value: "refunds_status" },
    { label: "Payment Issues", value: "payment_issues" },
    { label: "Delivery related", value: "delivery_related" },
    { label: "Others", value: "others" },
    { label: "Damaged Container", value: "damaged_container" },
    { label: "Spillage", value: "spillage" },
    { label: "Broken Seal", value: "broken_seal" },
    { label: "Presence of lumps in the container", value: "presence_of_lumps" },
  ];
  function getHelpTopicLabel(value) {
    return helpTopics.find((item) => item.value === value)?.label || value;
  }
  async function createTicket() {
    if (!helpTopic) {
      await shopify.toast.show("Please select Help Topic");
      return;
    }
    if (!subject.trim()) {
      await shopify.toast.show("Please enter Subject");
      return;
    }
    if (!details.trim()) {
      await shopify.toast.show("Please enter Details");
      return;
    }
    if (orderRequiredTopics.includes(helpTopic) && !selectedOrder) {
      await shopify.toast.show("Please select an order.");
      return;
    }
    try {
      const order = orders.find((o) => o.id === selectedOrder) || null;
      const formData = new FormData();
      const customerName =
        `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim() ||
        "Customer";

      const email = customer?.email || "";
      const phone = customer?.phone || "";
      formData.append("email", email);
      formData.append(
        "subject",
        order ? `${subject} For Order ID : ${order.name}` : subject,
      );
      formData.append("name", customerName);
      formData.append("telephone", phone);
      formData.append("replyTo", email);
      formData.append("details", details);
      const tableRows =
        order?.lineItems?.nodes?.map((item) => ({
          orderNo: order.name,
          awbNo: "",
          productDesc: item.title,
          qty: String(item.quantity),
          billValue: order.totalPrice.amount,
          complaintType: getHelpTopicLabel(helpTopic),
          queryDate: new Date(order.processedAt)
            .toLocaleDateString("en-GB")
            .replace(/\//g, "-"),
        })) ?? [];
      formData.append("tableRows", JSON.stringify(tableRows));
      uploadFields.forEach((field) => {
        field.files.forEach((file) => {
          formData.append("attachment", file);
        });
      });
      console.log("formData>>>", [...formData.entries()]);

      const response = await fetch(
        "https://hul-services.enscommerce.in/optimum-nutrition-arabia/freshdesk/create-ticket",
        {
          method: "POST",
          body: formData,
        },
      );
      const responseText = await response.text();
      let result = {};
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        // Response isn't JSON
      }
      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.error ||
            responseText ||
            "Error while creating Freshdesk ticket",
        );
      }
      if (
        result?.status === false ||
        result?.success === false ||
        result?.error
      ) {
        throw new Error(
          result?.message ||
            result?.error ||
            "Error while creating Freshdesk ticket",
        );
      }
      const successMessage = result?.message || "Ticket Created Successfully";
      await shopify.toast.show(successMessage);
      const newTicketId = result?.data?.id ?? result?.id ?? result?.ticket?.id;
      if (!newTicketId) {
        await shopify.toast.show(
          "Ticket created, but couldn't open details automatically.",
        );
        return;
      }
      const ticketId = result.data.id;
      await navigation.navigate("extension:customer-account-ui-2", {
        state: `ticket=${ticketId}`,
      });
    } catch (err) {
      console.error(err);
      const message =
        err?.message || "Unable to create ticket. Please try again.";
      await shopify.toast.show(message);
    }
  }

  return (
    <s-page heading="Create Ticket">
      <s-stack gap="large" inlineSize="650px">
        <s-select
          label="* Help Topic"
          value={helpTopic}
          onChange={(event) => handleHelpTopicChange(event.target.value)}
        >
          {helpTopics.map((topic) => (
            <s-option key={topic.value} value={topic.value}>
              {topic.label}
            </s-option>
          ))}
        </s-select>
        {orderRequiredTopics.includes(helpTopic) && (
          <>
            {loadingOrders ? (
              <s-spinner size="base" accessibilityLabel="Loading orders" />
            ) : (
              <s-stack gap="large">
                {orders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    selectedOrder={selectedOrder}
                    setSelectedOrder={setSelectedOrder}
                  />
                ))}
              </s-stack>
            )}
          </>
        )}
        <s-text-field
          label="* Subject"
          value={subject}
          onInput={(event) => setSubject(event.target.value)}
        />
        <s-text-area
          label="* Details"
          rows={6}
          value={details}
          onInput={(event) => setDetails(event.target.value)}
        />
        <s-stack>
          <s-link
            href="https://www.optimumnutrition.co.in/pages/return-policy"
            target="_blank"
          >
            Kindly refer to the return policy
          </s-link>
        </s-stack>
        <s-stack direction="block" gap="large" inlineSize="100%">
          <s-text>
            Please upload clear images of the product and outer packaging.
          </s-text>
          {uploadFields.map((field, index) => (
            <UploadRow
              key={field.id}
              field={field}
              isLast={index === uploadFields.length - 1}
              canRemove={uploadFields.length > 1}
              onFilesChange={updateFiles}
              onAdd={addUploadField}
              onRemove={removeUploadField}
            />
          ))}
        </s-stack>
        <s-button variant="primary" type="button" onClick={createTicket}>
          Create Ticket
        </s-button>
      </s-stack>
    </s-page>
  );
}

function UploadRow({
  field,
  isLast,
  canRemove,
  onFilesChange,
  onAdd,
  onRemove,
}) {
  return (
    <s-box border="base" borderRadius="base" padding="base" inlineSize="100%">
      <s-stack
        direction="inline"
        justifyContent="space-between"
        alignItems="center"
        gap="base"
      >
        <s-box inlineSize="100%">
          <s-drop-zone
            name={`file-${field.id}`}
            label="Upload image"
            accept="image/*"
            multiple={false}
            onChange={(event) => {
              const files =
                event.files ||
                event.target?.files ||
                event.currentTarget?.files ||
                [];
              onFilesChange(field.id, Array.from(files));
            }}
          />
          {field.files.length > 0 && (
            <s-stack direction="block" gap="small" paddingBlockStart="small">
              {field.files.map((file, index) => (
                <s-text key={index} color="subdued">
                  📷 {file.name}
                </s-text>
              ))}
            </s-stack>
          )}
        </s-box>
        <s-stack direction="inline" gap="small" alignItems="center">
          {isLast && (
            <s-button
              variant="plain"
              accessibilityLabel="Add upload"
              onClick={onAdd}
            >
              + Add More
            </s-button>
          )}
          {canRemove && (
            <s-button
              variant="plain"
              tone="critical"
              accessibilityLabel="Remove upload"
              onClick={() => onRemove(field.id)}
            >
              - Remove
            </s-button>
          )}
        </s-stack>
      </s-stack>
    </s-box>
  );
}

function OrderCard({ order, selectedOrder, setSelectedOrder }) {
  const [showAll, setShowAll] = useState(false);
  const products = order.lineItems.nodes;
  const visibleProducts = showAll ? products : products.slice(0, 2);
  const fulfillment = order.fulfillments?.nodes?.[0];
  const formattedDate = new Date(order.processedAt).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );
  return (
    <s-box
      border="base"
      borderRadius="large"
      padding="large"
      background="subdued"
    >
      <s-stack gap="large">
        <s-heading>Order ID: {order.name}</s-heading>
        <s-stack direction="inline" justifyContent="space-between">
          <s-text>Total Price: ₹{order.totalPrice.amount}</s-text>
          <s-text>No. Of Products: {products.length}</s-text>
          <s-text>Date: {formattedDate}</s-text>
        </s-stack>
        {visibleProducts.map((product) => (
          <ProductCard
            key={product.id}
            item={product}
            fulfillment={fulfillment}
            orderId={order.id}
            selectedOrder={selectedOrder}
            setSelectedOrder={setSelectedOrder}
          />
        ))}
        {products.length > 2 && (
          <s-button
            variant="secondary"
            type="button"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Show Less" : "Show More"}
          </s-button>
        )}
      </s-stack>
    </s-box>
  );
}

function ProductCard({
  item,
  fulfillment,
  orderId,
  selectedOrder,
  setSelectedOrder,
}) {
  const image = item.image?.url || item.variant?.image?.url || "";
  return (
    <s-box border="base" borderRadius="base" padding="small" background="base">
      <s-stack gap="base">
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-checkbox
            checked={selectedOrder === orderId}
            onChange={() => setSelectedOrder(orderId)}
          />
          <s-text type="strong">{fulfillment?.status || "UNFULFILLED"}</s-text>
        </s-stack>
        <s-text color="subdued">
          On{" "}
          {fulfillment
            ? new Date(fulfillment.createdAt).toLocaleDateString()
            : " - Not fulfilled yet"}
        </s-text>
        <s-stack direction="inline" gap="large" alignItems="center">
          {image ? (
            <s-box inlineSize="100px" blockSize="100px">
              <s-image
                src={image}
                alt={item.title}
                aspectRatio="1"
                objectFit="cover"
                inlineSize="fill"
                borderRadius="base"
              />
            </s-box>
          ) : (
            <s-box inlineSize="80px" blockSize="80px" border="base" />
          )}
          <s-stack gap="small">
            <s-text color="subdued">Product Name : {item.title}</s-text>
            <s-text>Qty: {item.quantity}</s-text>
          </s-stack>
        </s-stack>
      </s-stack>
    </s-box>
  );
}
