# Microsoft 365 დაკავშირება

CRM-ს Microsoft 365-თან ორი კავშირი აქვს. ორივე ცალ-ცალკე ირთვება გარემოს ცვლადებით და ორივეს ერთი Azure აპლიკაციის რეგისტრაცია ჰყოფნის.

| კავშირი | რას აკეთებს | გარემოს ცვლადები |
|---|---|---|
| შესვლა Microsoft ანგარიშით | თანამშრომელი შედის CRM-ში სამსახურის ანგარიშით, პაროლის გარეშე | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` |
| ყუთის მონიტორინგი | CRM ყოველ 5 წუთში კითხულობს info@ ყუთს და ახალ წერილებს „შემოსულებში“ აგდებს | `GRAPH_MAILBOX`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_TENANT_ID` |

## 1. Azure-ში აპლიკაციის რეგისტრაცია

1. გახსენით https://portal.azure.com → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. სახელი: `Line Net CRM`. Supported account types: **Single tenant**.
3. Redirect URI (Web): `https://<crm-domain>/api/auth/callback/microsoft` (ლოკალურად: `http://localhost:3000/api/auth/callback/microsoft`).
4. შექმნის შემდეგ ჩაიწერეთ **Application (client) ID** და **Directory (tenant) ID**.
5. **Certificates & secrets** → **New client secret** → ჩაიწერეთ მნიშვნელობა (მხოლოდ ერთხელ ჩანს).

## 2. შესვლა Microsoft ანგარიშით

`.env`-ში:

```
MICROSOFT_CLIENT_ID=<Application (client) ID>
MICROSOFT_CLIENT_SECRET=<client secret>
MICROSOFT_TENANT_ID=<Directory (tenant) ID>
```

გადატვირთვის შემდეგ ლოგინის გვერდზე გამოჩნდება ღილაკი „Microsoft ანგარიშით შესვლა“.

მნიშვნელოვანი: Microsoft-ით შესული მომხმარებელი CRM-ში იქმნება როლით **შემსრულებელი**. ადმინმა „მომხმარებლები“ გვერდზე უნდა შეუცვალოს როლი მენეჯერზე ან ადმინზე. თუ იგივე ელფოსტით მომხმარებელი უკვე არსებობს (ადმინმა ხელით შექმნა), Microsoft-ის ანგარიში ავტომატურად მიებმება მას.

## 3. ყუთის მონიტორინგი (Graph)

1. იმავე აპლიკაციაში: **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions** → `Mail.Read` → **Grant admin consent**.
2. უსაფრთხოებისთვის შეზღუდეთ წვდომა მხოლოდ ერთ ყუთზე (Exchange Online PowerShell):
   ```
   New-ApplicationAccessPolicy -AppId <client id> -PolicyScopeGroupId info@line-net.ge -AccessRight RestrictAccess
   ```
3. `.env`-ში:
   ```
   GRAPH_MAILBOX=info@line-net.ge
   GRAPH_CLIENT_ID=<Application (client) ID>
   GRAPH_CLIENT_SECRET=<client secret>
   GRAPH_TENANT_ID=<Directory (tenant) ID>
   ```
4. განრიგი: გამოიძახეთ `GET https://<crm-domain>/api/cron/poll-mail` ყოველ 5 წუთში header-ით `Authorization: Bearer <INBOUND_EMAIL_SECRET>`. Railway-ზე ეს ცალკე cron სერვისია ან გარე scheduler. „შემოსულები“ გვერდზე არის ღილაკი „შემოწმება ახლა“ ხელით გამოძახებისთვის.

პირველ გაშვებაზე იკითხება ბოლო 7 დღის წერილები, შემდეგ მხოლოდ ახლები. ერთი წერილი ერთხელ იქმნება (Message-ID-ით).

## 4. ალტერნატივა Graph-ის გარეშე: webhook

თუ Azure-ში წვდომა არ არის, ნებისმიერი სისტემა (Power Automate, Zapier, სკრიპტი) შეუძლია წერილი გამოაგზავნოს პირდაპირ:

```
POST https://<crm-domain>/api/inbound-email
Authorization: Bearer <INBOUND_EMAIL_SECRET>
Content-Type: application/json

{
  "messageId": "<უნიკალური id>",
  "from": "client@company.ge",
  "fromName": "კლიენტის სახელი",
  "subject": "თემა",
  "text": "წერილის ტექსტი",
  "html": "<p>ან HTML</p>",
  "receivedAt": "2026-09-16T10:00:00Z",
  "attachments": [{ "fileName": "a.pdf", "contentType": "application/pdf", "contentBase64": "..." }]
}
```

Power Automate-ში: trigger „When a new email arrives (V3)“ → action „HTTP“ (POST, ზემოთ მოცემული body). დანართებისთვის trigger-ში ჩართეთ „Include Attachments“.
