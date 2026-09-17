# Google Maps-ის ჩართვა

რუკა ორ რეჟიმში მუშაობს. გასაღების გარეშე OpenStreetMap გამოიყენება (უფასო, რეგისტრაციის გარეშე).
როცა Google-ის გასაღები ჩაიწერება, აპლიკაცია ავტომატურად Google Maps-ზე გადადის. კოდის შეცვლა საჭირო არ არის.

## ნაბიჯები

1. გახსენი https://console.cloud.google.com და შექმენი პროექტი (მაგ. `line-net-crm`).
2. **Billing** განყოფილებაში დაამატე ბარათი. Google უფასო ლიმიტსაც კი ბარათის გარეშე არ იძლევა.
3. **APIs & Services → Library**: ჩართე **Maps JavaScript API**.
4. **APIs & Services → Credentials → Create credentials → API key**. დააკოპირე გასაღები.
5. იმავე გასაღებზე **Restrict key**:
   - Application restrictions → **Websites** → დაამატე `http://localhost:3000/*` და შენი დომენი.
   - API restrictions → **Maps JavaScript API**.
6. (სურვილისამებრ) **Map management → Create Map ID** (Raster, JavaScript). თუ შექმნი, სტილს Google-ის კონსოლში მართავ.
7. ჩაწერე `.env.local`-ში:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=შენი-გასაღები
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=შენი-map-id   # სურვილისამებრ
```

8. გადატვირთე `npm run dev`. რუკა Google-ზე გადავა.

## ფასი

Google Maps Platform-ს აქვს ყოველთვიური უფასო ლიმიტი. Maps JavaScript API-სთვის ეს დაახლოებით
10 000 ჩატვირთვაა თვეში. ლაინნეტის მასშტაბით (რამდენიმე მენეჯერი და ტექნიკოსი) ეს ლიმიტი საკმარისზე
მეტია და ანგარიში ნულოვანი დარჩება. მაინც აუცილებელია:

- გასაღები დომენზე შეზღუდო (ნაბიჯი 5), თორემ სხვამ შეიძლება გამოიყენოს;
- Billing-ში **Budget alert** დააყენო, მაგ. 5 დოლარზე, რომ მოულოდნელობა არ იყოს.

## რატომ არა CARTO ან სხვა უფასო რუკა

- **CARTO** ფილებს ახლა წყალნიშნით გასცემს („API KEY REQUIRED“), ანუ გასაღების გარეშე გამოუსადეგარია.
- **Stadia Maps** გასაღებს ითხოვს (401 გასაღების გარეშე).
- **OpenStreetMap** უფასოა და გასაღები არ სჭირდება, ამიტომაა ნაგულისხმევი. მისი ფერები დაფისთვის
  ხმაურიანია, ამიტომ CSS-ით გავაფერმკრთალეთ და პინები გამოვკვეთეთ.
