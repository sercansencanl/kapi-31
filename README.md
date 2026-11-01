# Kapı 31

Antalya Limanı, 2031. Karbon Sınır Yönetmeliği'nin ilk haftasında sınır kapısında karbon denetçisisin. Belgeyi oku, kasayı aç, emisyonu hesapla, kimin geçeceğine karar ver. Kapıda verdiğin kararlar eve sıcak hava ve fatura olarak döner.

GameUP Türkiye iklim oyun hackathonu (2026) için geliştirildi.

## Oyna

Tarayıcıda çalışır, kurulum gerekmez. Yerelde çalıştırmak için `oyunu-baslat.bat` (Windows) ya da:

```
python sunucu.py
```

## Teknik

- Three.js (CDN), sade HTML/CSS/JS modülleri, derleme adımı yok
- 3D modeller ve sesler kodla üretilir
- Gökyüzü (HDRI) ve asfalt, beton, konteyner dokuları: [Poly Haven](https://polyhaven.com), CC0 lisansı (`assets/`)

## Not

Oyundaki yönetmelik kurgudur. Emisyon faktörleri yuvarlatılmış, taşıma faktörleri oyun dengesi için abartılmıştır. Gerçek AB SKDM yalnızca üretim emisyonlarını kapsar.
