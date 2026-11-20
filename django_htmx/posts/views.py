from django.http import HttpResponseNotAllowed
from django.shortcuts import render

from .models import Post


def visible_posts(request):
    query = request.GET.get('q', '').strip()
    rows = Post.objects.all()
    if query:
        rows = rows.filter(title__icontains=query)
    return rows


def index(request):
    return render(request, 'posts/index.html', {'posts': visible_posts(request)})


def post_list(request):
    return render(request, 'posts/_list.html', {'posts': visible_posts(request)})


def post_create(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    title = request.POST.get('title', '').strip()
    body = request.POST.get('body', '').strip()
    if 1 <= len(title) <= 200 and body:
        Post.objects.create(title=title, body=body)
    return render(request, 'posts/_list.html', {'posts': visible_posts(request)})
