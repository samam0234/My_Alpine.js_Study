from django.urls import path

from posts import views

urlpatterns = [
    path('', views.index, name='index'),
    path('posts/', views.post_list, name='post-list'),
    path('posts/new/', views.post_create, name='post-create'),
]
