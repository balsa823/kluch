// Shared i18n dictionary for the white-label agency site.
// Used both server-side (render.ts translates the initial HTML) and embedded
// into the page so the inline JS can live-switch when the visitor picks a language.
// SR/RU/TR are first-pass translations — review with a native speaker before launch.

export type Lang = "en" | "sr" | "ru" | "tr";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "sr", label: "SR" },
  { code: "ru", label: "RU" },
  { code: "tr", label: "TR" },
];

export const DICT: Record<Lang, Record<string, string>> = {
  en: {
    "nav.properties":"Properties","nav.about":"About","nav.contact":"Contact",
    "search.city":"City","search.cityPh":"Any city","search.dealType":"Listing","search.dealAny":"Any","search.type":"Type","search.typeAny":"Any type","search.typeResidential":"Residential","search.typeLand":"Land","search.typeCommercial":"Commercial",
    "search.minPrice":"Min price (€)","search.maxPrice":"Max price (€)","search.bedrooms":"Bedrooms","search.code":"Ref. code","search.submit":"Search","search.apply":"Apply filters","search.placeholder":"Search by address or ref code (e.g. ST-0042)",
    "filter.location":"Location","filter.price":"Price","filter.listing":"Listing","filter.beds":"Beds","filter.type":"Type","opt.any":"Any",
    "loc.searchPh":"Search city or area…","loc.clear":"Clear","loc.done":"Done",
    "beds.1plus":"1+","beds.2plus":"2+","beds.3plus":"3+","beds.4plus":"4+",
    "tab.all":"All","tab.rent":"For rent","tab.sale":"For sale","tab.clear":"Clear filters",
    "view.list":"List","view.map":"Map","map.approx":"Approximate location — exact address shared on enquiry","map.jumpToCity":"Jump to city","map.toTop":"Back to top","map.fitScreen":"Fit map to screen","map.below":"Jump below the map","map.expand":"Expand map","map.location":"Location","map.seeNearby":"Tap to view on map & see nearby",
    "pager.prev":"Previous","pager.next":"Next",
    "card.forRent":"For rent","card.forSale":"For sale","card.perMonth":" / mo","card.priceOnRequest":"Price on request","card.showNumber":"Show number","card.call":"Call",
    "modal.close":"Close","modal.gallery":"Photos",
    "tour.heading":"Schedule a tour","tour.date":"Preferred date","tour.note":"Note (optional)","tour.submit":"Request tour","tour.done":"Tour requested — the agency will be in touch.",
    "auth.heading":"Sign in to schedule","auth.email":"Email","auth.password":"Password","auth.name":"Name","auth.login":"Log in","auth.register":"Register","auth.toggleToRegister":"New here? Register on Kluche.me","auth.toggleToLogin":"Have an account? Log in","auth.signedInAs":"Signed in as",
    "properties.heading":"Available properties","properties.results":"Results for your filters ({n})","properties.empty":"No properties match your search.",
    "about.body":"We help you find the right home — to rent or to buy. Get in touch and our team will guide you, in your language, every step of the way.",
    "contact.heading":"Request info / book a viewing","contact.name":"Your name","contact.contact":"Email or phone","contact.message":"Message","contact.submit":"Send request",
    "contact.thankyou":"Thank you — we'll be in touch shortly.",
    "hero.title":"Find Your Perfect Home",
    "footer.hours":"Opening hours","footer.openNow":"Open now","footer.openUntil":"Open until {t}","footer.opensAt":"Opens {day} at {t}","footer.callNow":"Call us now","footer.closed":"Closed","footer.closedDay":"Closed","footer.contact":"Contact","footer.explore":"Explore","footer.about":"About","footer.map":"View on map",
    "day.mon":"Mon","day.tue":"Tue","day.wed":"Wed","day.thu":"Thu","day.fri":"Fri","day.sat":"Sat","day.sun":"Sun",
    "footer.powered":"Powered by Kluche"
  },
  sr: {
    "nav.properties":"Nekretnine","nav.about":"O nama","nav.contact":"Kontakt",
    "search.city":"Grad","search.cityPh":"Bilo koji grad","search.dealType":"Tip","search.dealAny":"Sve","search.dealRent":"Najam","search.dealSale":"Prodaja","search.typeResidential":"Stambeno","search.typeLand":"Zemljište","search.typeCommercial":"Poslovno",
    "search.minPrice":"Min. cijena","search.maxPrice":"Maks. cijena","search.bedrooms":"Spavaće sobe","search.code":"Šifra","search.submit":"Pretraga","search.apply":"Primijeni filtere","search.placeholder":"Pretraga po adresi ili šifri (npr. ST-0042)",
    "filter.location":"Lokacija","filter.price":"Cijena","filter.listing":"Tip","filter.beds":"Sobe","filter.type":"Vrsta","opt.any":"Sve",
    "loc.searchPh":"Pretraži grad ili oblast…","loc.clear":"Poništi","loc.done":"Gotovo",
    "beds.1plus":"1+","beds.2plus":"2+","beds.3plus":"3+","beds.4plus":"4+",
    "tab.all":"Sve","tab.rent":"Za najam","tab.sale":"Za prodaju","tab.clear":"Poništi filtere",
    "view.list":"Lista","view.map":"Mapa","map.approx":"Približna lokacija — tačna adresa se dijeli na upit","map.jumpToCity":"Skoči na grad","map.toTop":"Na vrh","map.fitScreen":"Uklopi mapu u ekran","map.below":"Ispod mape","map.expand":"Proširi mapu","map.location":"Lokacija","map.seeNearby":"Dodirni za prikaz na mapi i okolinu",
    "pager.prev":"Prethodno","pager.next":"Sljedeće",
    "card.forRent":"Za najam","card.forSale":"Za prodaju","card.perMonth":" / mj.","card.priceOnRequest":"Cijena na upit",
    "properties.heading":"Dostupne nekretnine","properties.results":"Rezultati filtriranja ({n})","properties.empty":"Nema nekretnina za vašu pretragu.",
    "about.body":"Pomažemo vam da pronađete pravi dom — za najam ili kupovinu. Javite nam se i naš tim će vas voditi, na vašem jeziku, na svakom koraku.",
    "contact.heading":"Zatražite informacije / zakažite obilazak","contact.name":"Vaše ime","contact.contact":"E-pošta ili telefon","contact.message":"Poruka","contact.submit":"Pošalji upit",
    "contact.thankyou":"Hvala — javićemo vam se uskoro.",
    "hero.title":"Pronađite svoj savršen dom",
    "footer.hours":"Radno vrijeme","footer.openNow":"Otvoreno","footer.openUntil":"Otvoreno do {t}","footer.opensAt":"Otvara se u {day} u {t}","footer.callNow":"Pozovite nas","footer.closed":"Zatvoreno","footer.closedDay":"Zatvoreno","footer.contact":"Kontakt","footer.explore":"Istražite","footer.about":"O nama","footer.map":"Prikaži na mapi",
    "day.mon":"Pon","day.tue":"Uto","day.wed":"Sri","day.thu":"Čet","day.fri":"Pet","day.sat":"Sub","day.sun":"Ned",
    "footer.powered":"Pokreće Kluche"
  },
  ru: {
    "nav.properties":"Объекты","nav.about":"О нас","nav.contact":"Контакты",
    "search.city":"Город","search.cityPh":"Любой город","search.dealType":"Тип","search.dealAny":"Все","search.dealRent":"Аренда","search.dealSale":"Продажа","search.typeResidential":"Жилая","search.typeLand":"Земля","search.typeCommercial":"Коммерческая",
    "search.minPrice":"Цена от","search.maxPrice":"Цена до","search.bedrooms":"Спальни","search.code":"Код","search.submit":"Поиск","search.apply":"Применить фильтры","search.placeholder":"Поиск по адресу или коду (напр. ST-0042)",
    "filter.location":"Локация","filter.price":"Цена","filter.listing":"Тип","filter.beds":"Спальни","filter.type":"Вид","opt.any":"Все",
    "loc.searchPh":"Поиск города или района…","loc.clear":"Сбросить","loc.done":"Готово",
    "beds.1plus":"1+","beds.2plus":"2+","beds.3plus":"3+","beds.4plus":"4+",
    "tab.all":"Все","tab.rent":"Аренда","tab.sale":"Продажа","tab.clear":"Сбросить фильтры",
    "view.list":"Список","view.map":"Карта","map.approx":"Приблизительное расположение — точный адрес сообщаем по запросу","map.jumpToCity":"Перейти к городу","map.toTop":"Наверх","map.fitScreen":"Вписать карту в экран","map.below":"Под картой","map.expand":"Развернуть карту","map.location":"Расположение","map.seeNearby":"Открыть на карте и рядом",
    "pager.prev":"Назад","pager.next":"Вперёд",
    "card.forRent":"Аренда","card.forSale":"Продажа","card.perMonth":" / мес.","card.priceOnRequest":"Цена по запросу",
    "properties.heading":"Доступные объекты","properties.results":"Результаты фильтрации ({n})","properties.empty":"Нет объектов по вашему запросу.",
    "about.body":"Мы поможем найти подходящее жильё — в аренду или для покупки. Свяжитесь с нами, и наша команда поможет вам на вашем языке на каждом шаге.",
    "contact.heading":"Запросить информацию / записаться на просмотр","contact.name":"Ваше имя","contact.contact":"Эл. почта или телефон","contact.message":"Сообщение","contact.submit":"Отправить запрос",
    "contact.thankyou":"Спасибо — мы скоро свяжемся с вами.",
    "hero.title":"Найдите свой идеальный дом",
    "footer.hours":"Часы работы","footer.openNow":"Открыто","footer.openUntil":"Открыто до {t}","footer.opensAt":"Откроется в {day} в {t}","footer.callNow":"Позвоните нам","footer.closed":"Закрыто","footer.closedDay":"Закрыто","footer.contact":"Контакты","footer.explore":"Обзор","footer.about":"О нас","footer.map":"Показать на карте",
    "day.mon":"Пн","day.tue":"Вт","day.wed":"Ср","day.thu":"Чт","day.fri":"Пт","day.sat":"Сб","day.sun":"Вс",
    "footer.powered":"Работает на Kluche"
  },
  tr: {
    "nav.properties":"İlanlar","nav.about":"Hakkımızda","nav.contact":"İletişim",
    "search.city":"Şehir","search.cityPh":"Tüm şehirler","search.dealType":"Tür","search.dealAny":"Tümü","search.dealRent":"Kiralık","search.dealSale":"Satılık","search.typeResidential":"Konut","search.typeLand":"Arsa","search.typeCommercial":"Ticari",
    "search.minPrice":"En düşük fiyat","search.maxPrice":"En yüksek fiyat","search.bedrooms":"Yatak odası","search.code":"Kod","search.submit":"Ara","search.apply":"Filtreleri uygula","search.placeholder":"Adres veya koda göre ara (örn. ST-0042)",
    "filter.location":"Konum","filter.price":"Fiyat","filter.listing":"Tür","filter.beds":"Oda","filter.type":"Tip","opt.any":"Tümü",
    "loc.searchPh":"Şehir veya bölge ara…","loc.clear":"Temizle","loc.done":"Tamam",
    "beds.1plus":"1+","beds.2plus":"2+","beds.3plus":"3+","beds.4plus":"4+",
    "tab.all":"Tümü","tab.rent":"Kiralık","tab.sale":"Satılık","tab.clear":"Filtreleri temizle",
    "view.list":"Liste","view.map":"Harita","map.approx":"Yaklaşık konum — kesin adres talep üzerine paylaşılır","map.jumpToCity":"Şehre git","map.toTop":"Başa dön","map.fitScreen":"Haritayı ekrana sığdır","map.below":"Haritanın altına","map.expand":"Haritayı genişlet","map.location":"Konum","map.seeNearby":"Haritada gör ve yakındakiler",
    "pager.prev":"Önceki","pager.next":"Sonraki",
    "card.forRent":"Kiralık","card.forSale":"Satılık","card.perMonth":" / ay","card.priceOnRequest":"Fiyat için sorun",
    "properties.heading":"Mevcut ilanlar","properties.results":"Filtre sonuçları ({n})","properties.empty":"Aramanıza uygun ilan yok.",
    "about.body":"Doğru evi bulmanıza yardımcı oluyoruz — kiralık ya da satılık. Bize ulaşın, ekibimiz her adımda kendi dilinizde size yardımcı olsun.",
    "contact.heading":"Bilgi isteyin / randevu alın","contact.name":"Adınız","contact.contact":"E-posta veya telefon","contact.message":"Mesaj","contact.submit":"Gönder",
    "contact.thankyou":"Teşekkürler — en kısa sürede sizinle iletişime geçeceğiz.",
    "hero.title":"Mükemmel Evinizi Bulun",
    "footer.hours":"Çalışma saatleri","footer.openNow":"Açık","footer.openUntil":"{t}'e kadar açık","footer.opensAt":"{day} {t}'de açılır","footer.callNow":"Bizi arayın","footer.closed":"Kapalı","footer.closedDay":"Kapalı","footer.contact":"İletişim","footer.explore":"Keşfet","footer.about":"Hakkımızda","footer.map":"Haritada göster",
    "day.mon":"Pzt","day.tue":"Sal","day.wed":"Çar","day.thu":"Per","day.fri":"Cum","day.sat":"Cmt","day.sun":"Paz",
    "footer.powered":"Kluche tarafından sağlanır"
  }
};

export function tr(lang: Lang, key: string): string {
  return DICT[lang]?.[key] ?? DICT.en[key] ?? key;
}

export function isLang(x: unknown): x is Lang {
  return x === "en" || x === "sr" || x === "ru" || x === "tr";
}
