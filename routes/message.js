// routes/message.js
const express = require('express');
const router = express.Router();

/*
  صفحة رسائل عامة بالـ code:
  - pending: تم التسجيل، الطلب قيد موافقة الأدمن
  - duplicate: الإيميل مسجل بالفعل
  - missing: بيانات ناقصة
  - badrole: رول غير صالح
  - invalid: بيانات دخول غير صحيحة
  - notapproved: الحساب لسه مش Approved
  - error: أي خطأ عام
*/

router.get('/message', (req, res) => {
  const { code } = req.query;

  const map = {
    pending: {
      title: 'Request Submitted',
      text: 'Your request is pending admin approval. Please wait for confirmation via email.',
      ctaHref: '/login',
      ctaText: 'Go to Login'
    },
    duplicate: {
      title: 'Email Already Registered',
      text: 'This email is already registered. Please login or use a different email.',
      ctaHref: '/login',
      ctaText: 'Go to Login'
    },
    missing: {
      title: 'Missing Data',
      text: 'Please fill in all required fields.',
      ctaHref: '/signup',
      ctaText: 'Back to Sign Up'
    },
    badrole: {
      title: 'Invalid Role',
      text: 'Selected role does not exist. Please try again.',
      ctaHref: '/signup',
      ctaText: 'Back to Sign Up'
    },
    invalid: {
      title: 'Invalid Credentials',
      text: 'Email or password is incorrect.',
      ctaHref: '/login',
      ctaText: 'Back to Login'
    },
    notapproved: {
      title: 'Not Approved Yet',
      text: 'Your account is not approved yet. Please wait for admin approval.',
      ctaHref: '/login',
      ctaText: 'Back to Login'
    },
    error: {
      title: 'Something Went Wrong',
      text: 'An unexpected error occurred. Please try again later.',
      ctaHref: '/signup',
      ctaText: 'Back to Sign Up'
    }
  };

  const msg = map[code] || map.error;
  res.render('message', { ...msg });
});

module.exports = router;
