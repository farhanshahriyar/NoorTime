export interface District {
  name: string;
  bn: string;
  lat: number;
  lng: number;
}

export interface Division {
  name: string;
  bn: string;
  districts: District[];
}

export const DIVISIONS: Division[] = [
  {
    name: 'Dhaka',
    bn: 'ঢাকা',
    districts: [
      { name: 'Dhaka', bn: 'ঢাকা', lat: 23.8103, lng: 90.4125 },
      { name: 'Gazipur', bn: 'গাজীপুর', lat: 24.0022, lng: 90.4264 },
      { name: 'Narayanganj', bn: 'নারায়ণগঞ্জ', lat: 23.6238, lng: 90.5 },
      { name: 'Narsingdi', bn: 'নরসিংদী', lat: 23.9324, lng: 90.7151 },
      { name: 'Manikganj', bn: 'মানিকগঞ্জ', lat: 23.8627, lng: 90.0037 },
      { name: 'Munshiganj', bn: 'মুন্সীগঞ্জ', lat: 23.5422, lng: 90.5305 },
      { name: 'Rajbari', bn: 'রাজবাড়ী', lat: 23.7574, lng: 89.6442 },
      { name: 'Madaripur', bn: 'মাদারীপুর', lat: 23.1643, lng: 90.1983 },
      { name: 'Gopalganj', bn: 'গোপালগঞ্জ', lat: 23.0054, lng: 89.8261 },
      { name: 'Shariatpur', bn: 'শরীয়তপুর', lat: 23.2423, lng: 90.4348 },
      { name: 'Kishoreganj', bn: 'কিশোরগঞ্জ', lat: 24.4449, lng: 90.7766 },
      { name: 'Tangail', bn: 'টাঙ্গাইল', lat: 24.2513, lng: 89.9167 },
      { name: 'Faridpur', bn: 'ফরিদপুর', lat: 23.607, lng: 89.8429 },
    ],
  },
  {
    name: 'Chattogram',
    bn: 'চট্টগ্রাম',
    districts: [
      { name: 'Chattogram', bn: 'চট্টগ্রাম', lat: 22.3569, lng: 91.7832 },
      { name: 'Cox\'s Bazar', bn: 'কক্সবাজার', lat: 21.4272, lng: 92.0058 },
      { name: 'Feni', bn: 'ফেনী', lat: 23.0159, lng: 91.3976 },
      { name: 'Comilla', bn: 'কুমিল্লা', lat: 23.4607, lng: 91.1809 },
      { name: 'Noakhali', bn: 'নোয়াখালী', lat: 22.8696, lng: 91.0993 },
      { name: 'Lakshmipur', bn: 'লক্ষ্মীপুর', lat: 22.9425, lng: 90.841 },
      { name: 'Chandpur', bn: 'চাঁদপুর', lat: 23.2332, lng: 90.6714 },
      { name: 'Brahmanbaria', bn: 'ব্রাহ্মণবাড়িয়া', lat: 23.9608, lng: 91.1115 },
      { name: 'Khagrachhari', bn: 'খাগড়াছড়ি', lat: 23.1193, lng: 91.9847 },
      { name: 'Rangamati', bn: 'রাঙামাটি', lat: 22.6552, lng: 92.1717 },
      { name: 'Bandarban', bn: 'বান্দরবান', lat: 22.1953, lng: 92.2183 },
    ],
  },
  {
    name: 'Rajshahi',
    bn: 'রাজশাহী',
    districts: [
      { name: 'Rajshahi', bn: 'রাজশাহী', lat: 24.3745, lng: 88.6042 },
      { name: 'Chapainawabganj', bn: 'চাঁপাইনবাবগঞ্জ', lat: 24.5965, lng: 88.2727 },
      { name: 'Naogaon', bn: 'নওগাঁ', lat: 24.8465, lng: 88.9312 },
      { name: 'Natore', bn: 'নাটোর', lat: 24.4103, lng: 89.0 },
      { name: 'Sirajganj', bn: 'সিরাজগঞ্জ', lat: 24.4534, lng: 89.7006 },
      { name: 'Pabna', bn: 'পাবনা', lat: 24.0064, lng: 89.2372 },
      { name: 'Bogura', bn: 'বগুড়া', lat: 24.8465, lng: 89.3773 },
      { name: 'Joypurhat', bn: 'জয়পুরহাট', lat: 25.1, lng: 89.0167 },
    ],
  },
  {
    name: 'Khulna',
    bn: 'খুলনা',
    districts: [
      { name: 'Khulna', bn: 'খুলনা', lat: 22.8456, lng: 89.5403 },
      { name: 'Bagerhat', bn: 'বাগেরহাট', lat: 22.651, lng: 89.7854 },
      { name: 'Satkhira', bn: 'সাতক্ষীরা', lat: 22.7185, lng: 89.0705 },
      { name: 'Jessore', bn: 'যশোর', lat: 23.1667, lng: 89.2167 },
      { name: 'Narail', bn: 'নড়াইল', lat: 23.1724, lng: 89.5124 },
      { name: 'Magura', bn: 'মাগুরা', lat: 23.4873, lng: 89.4192 },
      { name: 'Jhenaidah', bn: 'ঝিনাইদহ', lat: 23.5448, lng: 89.1527 },
      { name: 'Kushtia', bn: 'কুষ্টিয়া', lat: 23.901, lng: 89.1202 },
      { name: 'Meherpur', bn: 'মেহেরপুর', lat: 23.7621, lng: 88.6318 },
      { name: 'Chuadanga', bn: 'চুয়াডাঙ্গা', lat: 23.6402, lng: 88.8416 },
    ],
  },
  {
    name: 'Barishal',
    bn: 'বরিশাল',
    districts: [
      { name: 'Barishal', bn: 'বরিশাল', lat: 22.701, lng: 90.3535 },
      { name: 'Bhola', bn: 'ভোলা', lat: 22.6859, lng: 90.6482 },
      { name: 'Patuakhali', bn: 'পটুয়াখালী', lat: 22.3596, lng: 90.3296 },
      { name: 'Pirojpur', bn: 'পিরোজপুর', lat: 22.5841, lng: 89.9685 },
      { name: 'Jhalokati', bn: 'ঝালকাঠি', lat: 22.6418, lng: 90.1979 },
      { name: 'Barguna', bn: 'বরগুনা', lat: 22.1504, lng: 90.1165 },
    ],
  },
  {
    name: 'Sylhet',
    bn: 'সিলেট',
    districts: [
      { name: 'Sylhet', bn: 'সিলেট', lat: 24.8949, lng: 91.8687 },
      { name: 'Moulvibazar', bn: 'মৌলভীবাজার', lat: 24.4829, lng: 91.7774 },
      { name: 'Habiganj', bn: 'হবিগঞ্জ', lat: 24.374, lng: 91.4153 },
      { name: 'Sunamganj', bn: 'সুনামগঞ্জ', lat: 25.0658, lng: 91.3978 },
    ],
  },
  {
    name: 'Rangpur',
    bn: 'রংপুর',
    districts: [
      { name: 'Rangpur', bn: 'রংপুর', lat: 25.7439, lng: 89.2752 },
      { name: 'Dinajpur', bn: 'দিনাজপুর', lat: 25.6279, lng: 88.6338 },
      { name: 'Thakurgaon', bn: 'ঠাকুরগাঁও', lat: 26.0336, lng: 88.4616 },
      { name: 'Panchagarh', bn: 'পঞ্চগড়', lat: 26.3411, lng: 88.5542 },
      { name: 'Nilphamari', bn: 'নীলফামারী', lat: 25.9315, lng: 88.856 },
      { name: 'Lalmonirhat', bn: 'লালমনিরহাট', lat: 25.9923, lng: 89.2847 },
      { name: 'Kurigram', bn: 'কুড়িগ্রাম', lat: 25.805, lng: 89.6361 },
      { name: 'Gaibandha', bn: 'গাইবান্ধা', lat: 25.3288, lng: 89.5285 },
    ],
  },
  {
    name: 'Mymensingh',
    bn: 'ময়মনসিংহ',
    districts: [
      { name: 'Mymensingh', bn: 'ময়মনসিংহ', lat: 24.7471, lng: 90.4203 },
      { name: 'Jamalpur', bn: 'জামালপুর', lat: 24.9375, lng: 89.9378 },
      { name: 'Sherpur', bn: 'শেরপুর', lat: 25.0198, lng: 90.0151 },
      { name: 'Netrokona', bn: 'নেত্রকোণা', lat: 24.8703, lng: 90.7279 },
    ],
  },
];
