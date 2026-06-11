const http = require('http');

function req(opts, data) {
  return new Promise((resolve, reject) => {
    const r = http.request(opts, resp => {
      let b = '';
      resp.on('data', c => b += c);
      resp.on('end', () => {
        try { resolve({ s: resp.statusCode, d: JSON.parse(b) }); }
        catch(e) { resolve({ s: resp.statusCode, d: b }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const SUBJECTS = [
  'Toan hoc THPT',
  'Ngu van THPT',
  'Tieng Anh THPT',
  'Vat ly THPT',
  'Hoa hoc THPT',
  'Sinh hoc THPT',
  'Lich su THPT',
  'Dia ly THPT',
  'GDCD THPT',
  'Tin hoc THPT',
  'Cong nghe THPT'
];

const PROMPTS = [
  'Ban la GV Toan THPT. Soan giao an: Mon: {{subject}}, Lop: {{grade}}, Bai: {{topic}}, Muc tieu: {{objectives}}, Thoi luong: {{duration}}, Framework: {{framework}}. Cau truc: {{framework_structure}}. Yeu cau: 1.Muc tieu ro rang 2.Bai toan thuc te 3.Vi du minh hoa 4.Phuong phap tich cuc 5.Danh gia. Viet tieng Viet chi tiet.',
  'Ban la GV Ngu van THPT. Soan giao an: Mon: {{subject}}, Lop: {{grade}}, Bai: {{topic}}, Muc tieu: {{objectives}}, Thoi luong: {{duration}}, Framework: {{framework}}. Cau truc: {{framework_structure}}. Yeu cau: 1.Muc tieu doc-viet-noi 2.Lien he tac pham 3.Phan tich the loai 4.Cau hoi goi mo 5.Danh gia nang luc. Viet tieng Viet chi tiet.',
  'Ban la GV Tieng Anh THPT. Soan giao an: Mon: {{subject}}, Lop: {{grade}}, Bai: {{topic}}, Muc tieu: {{objectives}}, Thoi luong: {{duration}}, Framework: {{framework}}. Cau truc: {{framework_structure}}. Yeu cau: 1.Muc tieu 4 ky nang 2.Warm-up thuc te 3.Controlled-freer practice 4.Tich hop ky nang 5.Tieu chi danh gia. Viet tieng Viet chi tiet.',
  'Ban la GV Vat ly THPT. Soan giao an: Mon: {{subject}}, Lop: {{grade}}, Bai: {{topic}}, Muc tieu: {{objectives}}, Thoi luong: {{duration}}, Framework: {{framework}}. Cau truc: {{framework_structure}}. Yeu cau: 1.Hien tuong thuc te 2.Thi nghiem minh hoa 3.Hien tuong-ly thuyet-cong thuc 4.Bai tap dinh tinh dinh luong 5.Ung dung. Viet tieng Viet chi tiet.',
  'Ban la GV Hoa hoc THPT. Soan giao an: Mon: {{subject}}, Lop: {{grade}}, Bai: {{topic}}, Muc tieu: {{objectives}}, Thoi luong: {{duration}}, Framework: {{framework}}. Cau truc: {{framework_structure}}. Yeu cau: 1.Kien thuc-ky nang thi nghiem 2.Thi nghiem an toan 3.Phuong trinh hoa hoc 4.Bai tap tu de den kho 5.Lien he doi song. Viet tieng Viet chi tiet.',
  'Ban la GV Sinh hoc THPT. Soan giao an: Mon: {{subject}}, Lop: {{grade}}, Bai: {{topic}}, Muc tieu: {{objectives}}, Thoi luong: {{duration}}, Framework: {{framework}}. Cau truc: {{framework_structure}}. Yeu cau: 1.Quan sat-tu duy khoa hoc 2.Hinh anh so do 3.Lien mon hoa-ly 4.Bai tap y hoc-nong nghiep 5.Thuc hanh. Viet tieng Viet chi tiet.',
  'Ban la GV Lich su THPT. Soan giao an: Mon: {{subject}}, Lop: {{grade}}, Bai: {{topic}}, Muc tieu: {{objectives}}, Thoi luong: {{duration}}, Framework: {{framework}}. Cau truc: {{framework_structure}}. Yeu cau: 1.Kien thuc-yeu nuoc 2.Tu lieu ban do 3.Ke chuyen-dong vai 4.So sanh su kien 5.Lien he hien tai. Viet tieng Viet chi tiet.',
  'Ban la GV Dia ly THPT. Soan giao an: Mon: {{subject}}, Lop: {{grade}}, Bai: {{topic}}, Muc tieu: {{objectives}}, Thoi luong: {{duration}}, Framework: {{framework}}. Cau truc: {{framework_structure}}. Yeu cau: 1.Tu nhien-kinh te xa hoi 2.Ban do bieu do 3.Quan he tu nhien-kinh te 4.Phan tich so lieu 5.Lien he VN-the gioi. Viet tieng Viet chi tiet.',
  'Ban la GV GDCD THPT. Soan giao an: Mon: {{subject}}, Lop: {{grade}}, Bai: {{topic}}, Muc tieu: {{objectives}}, Thoi luong: {{duration}}, Framework: {{framework}}. Cau truc: {{framework_structure}}. Yeu cau: 1.Phap luat-dao duc-ky nang song 2.Tinh huong thuc te 3.Thao luan-sam vai 4.Tu duy phan bien 5.Quyen-nghia vu cong dan. Viet tieng Viet chi tiet.',
  'Ban la GV Tin hoc THPT. Soan giao an: Mon: {{subject}}, Lop: {{grade}}, Bai: {{topic}}, Muc tieu: {{objectives}}, Thoi luong: {{duration}}, Framework: {{framework}}. Cau truc: {{framework_structure}}. Yeu cau: 1.Ly thuyet-thuc hanh 2.Thuc hanh nhieu hon ly thuyet 3.Tung buoc ro rang 4.An toan thong tin 5.San pham kiem tra duoc. Viet tieng Viet chi tiet.',
  'Ban la GV Cong nghe THPT. Soan giao an: Mon: {{subject}}, Lop: {{grade}}, Bai: {{topic}}, Muc tieu: {{objectives}}, Thoi luong: {{duration}}, Framework: {{framework}}. Cau truc: {{framework_structure}}. Yeu cau: 1.Ky thuat-thuc hanh an toan 2.Mo hinh vat that 3.Quy trinh tung buoc 4.Ung dung doi song 5.Danh gia san pham. Viet tieng Viet chi tiet.'
];

const VARS = '["subject","grade","topic","objectives","duration","framework","framework_structure"]';

async function main() {
  const loginBody = JSON.stringify({ email: 'admin@planbookai.com', password: 'Admin@123' });
  const lr = await req({
    hostname: 'localhost', port: 8080,
    path: '/api/v1/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) }
  }, loginBody);

  const token = lr.d?.token || lr.d?.accessToken;
  if (!token) { console.error('Login failed:', JSON.stringify(lr.d)); return; }
  console.log('Logged in OK');

  for (let i = 0; i < SUBJECTS.length; i++) {
    const title = SUBJECTS[i];
    const promptText = PROMPTS[i];
    const body = JSON.stringify({ title, purpose: 'LESSON_PLAN_GEN', promptText, variables: VARS });

    const cr = await req({
      hostname: 'localhost', port: 8080,
      path: '/api/v1/prompt-templates', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'Content-Length': Buffer.byteLength(body)
      }
    }, body);

    const id = cr.d?.id || cr.d?.data?.id;
    if (cr.s === 200 || cr.s === 201) {
      console.log('Created: ' + title + ' (id=' + id + ')');
      const ar = await req({
        hostname: 'localhost', port: 8080,
        path: '/api/v1/prompt-templates/' + id + '/approve',
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Length': 0 }
      }, '');
      console.log('  Approved: HTTP ' + ar.s);
    } else {
      console.error('FAIL ' + title + ': ' + JSON.stringify(cr.d).substring(0, 200));
    }
  }
  console.log('All done!');
}

main().catch(console.error);
