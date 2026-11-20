from django.test import Client, TestCase

from .models import Post


class AlpineHtmxPageTests(TestCase):
    def test_index_keeps_alpine_and_htmx_together(self):
        response = self.client.get('/')
        self.assertContains(response, 'x-data="{ menu: false, composer: false }"')
        self.assertContains(response, 'hx-get')
        self.assertContains(response, 'hx-post')
        self.assertContains(response, 'alpinejs@3.17.5')
        self.assertContains(response, 'htmx.org@2.0.4')
        self.assertContains(response, '첫 글')

    def test_search_swaps_only_the_list(self):
        response = self.client.get('/posts/', {'q': '둘째'})
        self.assertContains(response, '둘째 글')
        self.assertNotContains(response, '첫 글')
        self.assertNotContains(response, 'x-data')

    def test_create_uses_csrf_and_returns_the_list_fragment(self):
        client = Client(enforce_csrf_checks=True)
        denied = client.post('/posts/new/', {'title': '새 글', 'body': '본문'})
        self.assertEqual(denied.status_code, 403)
        page = client.get('/')
        token = page.cookies['csrftoken'].value
        created = client.post('/posts/new/', {
            'title': '새 글',
            'body': '본문',
            'csrfmiddlewaretoken': token,
        })
        self.assertEqual(created.status_code, 200)
        self.assertContains(created, '새 글')
        self.assertNotContains(created, '<html')
        self.assertEqual(Post.objects.filter(title='새 글').count(), 1)

    def test_empty_title_is_not_saved(self):
        before = Post.objects.count()
        self.client.post('/posts/new/', {'title': '   ', 'body': ''})
        self.assertEqual(Post.objects.count(), before)
